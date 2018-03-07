#!/usr/bin/env node
'use strict'

const mri = require('mri')
const so = require('so')
const chalk = require('chalk')
const fs = require('fs')

const pkg = require('./package.json')
const lib = require('./lib')

const argv = mri(process.argv.slice(2), {
	boolean: ['help', 'h', 'version', 'v']
})

const opt = {
	datafile: argv._[0] || './data.ndjson',
	help: argv.help || argv.h,
	version: argv.version || argv.v
}

if (opt.help === true) {
	process.stdout.write(`
vbb-platform-patterns [datafile] [options]

Arguments:
    datafile        NDJSON data file path (default: './data.ndjson').

Options:
    --help      -h  Show help dialogue (this)
    --version   -v  Show version
`)
	process.exit(0)
}

if (opt.version === true) {
	process.stdout.write(`vbb-platform-patterns-cli v${pkg.version}\n`)
	process.exit(0)
}


const showError = function (err) {
	console.error(err)
	if (process.env.NODE_DEBUG === 'vbb-platform-patterns-cli') console.error(err)
	process.stderr.write(chalk.red(err.message) + '\n')
	process.exit(err.code || 1)
}

const main = so(function* (opt) {
	let station, lines, previousStation, nextStation, colors, image

	// query station
	station = yield lib.queryStation('Station?')
	try {
		station = yield lib.parseStation(station)
	} catch (err) {
		showError(err)
	}

	// query lines
	lines = yield lib.queryLines('Lines (multiple selections allowed)?', station.id)
	try {
		lines = lib.parseLines(lines)
	} catch (err) {
		showError(err)
	}

	// query previousStation
	previousStation = yield lib.queryStation('Previous station (can be empty)?')
	try {
		previousStation = yield lib.parseStation(previousStation)
	} catch (err) {
		showError(err)
	}

	// query nextStation
	nextStation = yield lib.queryStation('Next station (can be empty)?')
	try {
		nextStation = yield lib.parseStation(nextStation)
	} catch (err) {
		showError(err)
	}

	// query colors
	colors = yield lib.queryColors('Pattern color (multiple selections allowed)?')
	try {
		colors = lib.parseColors(colors)
	} catch (err) {
		showError(err)
	}

	// query image url
	image = yield lib.queryImage('Pattern image URL (can be empty)?')
	try {
		image = lib.parseImage(image)
	} catch (err) {
		showError(err)
	}

	const entry = lib.buildEntry({
		station,
		lines,
		previousStation,
		nextStation,
		colors,
		image
	})

	const ndjson = JSON.stringify(entry)+"\n"

	try{
		fs.appendFileSync(opt.datafile, ndjson)
		console.log('Appended to '+opt.datafile)
	} catch(err) {
		showError(err)
	}

	process.stdout.write(ndjson)
})

main(opt).catch(showError)
