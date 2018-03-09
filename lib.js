'use strict'

const client = require('vbb-client')
const autocompletePrompt = require('cli-autocomplete')
const textPrompt = require('text-prompt')
const util = require('vbb-util')
const chalk = require('chalk')
const multiselectPrompt = require('multiselect-prompt')
const selectPrompt = require('select-prompt')
const linesAt = require('vbb-lines-at')
const uniqBy = require('lodash.uniqby')
const uniq = require('lodash.uniq')
const sortBy = require('lodash.sortby')
const pick = require('lodash.pick')
const isURL = require('is-url')
const isHexcolor = require('is-hexcolor')
const shorten = require('shorten-hex-color')

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

// Color
const parseColor = (c) => {
	if(!c) return null
	if(!isHexcolor(c)) throw new Error('Invalid color')
	return shorten(c)
}
const parseNotNullColor = (c) => {
	if(!c || !isHexcolor(c)) throw new Error('Invalid color')
	return shorten(c)
}
const queryColor = (msg) => new Promise((yay, nay) =>
	textPrompt(msg)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

// Image Source
const sources = [
	{title: 'None', value: null},
	{title: 'Wikimedia Commons', value: 'commons'},
	{title: 'Flickr', value: 'flickr'}
]
const queryImageSource = (msg) => new Promise((yay, nay) =>
	selectPrompt(msg, sources)
	.on('abort', v => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

// Commons Filename
const parseCommonsFilename = (c) => {
	if(!c || c.length <= 0) throw new Error('Invalid commons filename')
	return c
}
const queryCommonsFilename = (msg) => new Promise((yay, nay) =>
	textPrompt(msg)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

// Flickr User
const parseFlickrUser = (u) => {
	if(!u || u.length <= 0) throw new Error('Invalid flickr username')
	return u
}
const queryFlickrUser = (msg) => new Promise((yay, nay) =>
	textPrompt(msg)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

// Flickr Image ID
const parseFlickrImage = (i) => {
	i = +i
	if(!i || i < 0 || !Number.isInteger(i)) throw new Error('Invalid flickr image ID')
	return i
}
const queryFlickrImage = (msg) => new Promise((yay, nay) =>
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
		colors: uniq(p.colors),
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
	parseColor, parseNotNullColor, queryColor,
	queryImageSource,
	parseCommonsFilename, queryCommonsFilename,
	parseFlickrUser, queryFlickrUser,
	parseFlickrImage, queryFlickrImage,
	buildEntry
}
