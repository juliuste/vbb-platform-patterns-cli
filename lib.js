'use strict'

const client = require('vbb-client')
const autocompletePrompt = require('cli-autocomplete')
const textPrompt = require('text-prompt')
const util = require('vbb-util')
const chalk = require('chalk')
const multiselectPrompt = require('multiselect-prompt')
const linesAt = require('vbb-lines-at')
const uniqBy = require('lodash.uniqby')
const sortBy = require('lodash.sortby')
const pick = require('lodash.pick')
const isURL = require('is-url')
const cssColors = require('css-color-names')

const css2Colors = ['black', 'silver', 'gray', 'white', 'maroon', 'red', 'purple', 'fuchsia', 'green', 'lime', 'olive', 'yellow', 'navy', 'blue', 'teal', 'aqua', 'orange']
const allowedColors = pick(cssColors, css2Colors)

// STATIONS
const isStationId = (s) => /^\d{12}$/.test(s.toString())
const parseStation = (query) => {
	if(!query || query.length === 0) return Promise.resolve(null)
	if (isStationId(query)) return client.station(''+query)

	return client.stations({
		query, results: 1,
		identifier: 'vbb-change-positions-cli'
	})
	.then(([station]) => {
		if (!station) throw new Error('Station not found.')
		return station
	})
}
const suggestStations = (input) => {
	if (!input || input === '') return Promise.resolve([])

	return client.stations({
		query: input, completion: true, results: 5,
		identifier: 'vbb-change-positions-cli'
	})
	.then((stations) => stations.slice(0, 5).map((s) => ({
		title: s.name + ' – ' + s.id, value: s.id
	})))
}
const queryStation = (msg) => {
	return new Promise((yay, nay) => {
		autocompletePrompt(chalk.bold(msg), suggestStations)
		.on('submit', yay)
		.on('abort', (val) => {
			nay(new Error(`Rejected with ${val}.`))
		})
	})
}

// LINES
const lineColor = (l) => util.lines.colors[l.product][l.name].bg
const lines = (stationId) =>
	uniqBy(
		linesAt[stationId]
		.filter(l => ['subway', 'suburban'].includes(l.product)),
		l => l.name
	).map(l => {
		l.color = lineColor(l)
		return l
	})
const lineChoices = (stationId) => sortBy(lines(stationId), l => l.name).map((line) => ({
	value: line.name,
	title: chalk.hex(line.color || '#fff')(line.name),
	selected: false
}))
const queryLines = (msg, stationId) => new Promise((yay, nay) =>
	multiselectPrompt(msg, lineChoices(stationId))
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', (lines) => yay(lines.reduce((acc, l) => {
		acc[l.value] = l.selected
		return acc
	}, {}))))
const isValidLine = (l) => l in lines.map(l => l.name)
const reduceLines = (acc, l) => {
	acc[l] = true
	return acc
}
const parseLines = (l) => {
	if(Object.keys(l).every(k => l[k]===false)) throw new Error('At least one line must be selected.')
	return l
}


// COLORS
const colorChoices = Object.keys(allowedColors).map(c => ({
	value: c,
	title: chalk.hex(allowedColors[c] || '#fff')(c),
	selected: false
}))
const selected = (items) => items.filter((item) => item.selected).map((item) => item.value)
const queryColors = (msg) => new Promise((yay, nay) =>
	multiselectPrompt(msg, colorChoices)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', (colors) => yay(selected(colors)))
)
const parseColors = (c) => {
	if(c.length === 0) throw new Error('At least one color must be selected.')
	return c
}

// Image URL
const parseImage = (t) => {
	if(!t) t = null
	if(t && !isURL(t)) throw new Error('Invalid image url')
	return t
}
const queryImage = (msg) => new Promise((yay, nay) =>
	textPrompt(msg)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

const buildEntry = (p) => {
	const res = {
		station: pick(p.station, ['id', 'name']),
		lines: Object.keys(p.lines).filter(k => p.lines[k]),
		previousStation: pick(p.previousStation, ['id', 'name']),
		nextStation: pick(p.nextStation, ['id', 'name']),
		colors: p.colors,
		image: p.image
	}
	if(!res.image) delete res.image
	if(Object.keys(res.previousStation).length === 0) delete res.previousStation
	if(Object.keys(res.nextStation).length === 0) delete res.nextStation
	return res
}

module.exports = {
	parseStation, queryStation,
	parseLines, queryLines,
	parseColors, queryColors,
	parseImage, queryImage,
	buildEntry
}
