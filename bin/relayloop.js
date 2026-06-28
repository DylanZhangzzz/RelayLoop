#!/usr/bin/env node

const { main } = require("./teamloop.js");

process.exitCode = main(process.argv);
