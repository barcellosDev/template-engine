'use strict'

const { Template } = require('./template.js')

const template = new Template()

const compiled = template.renderFile('examples/include', {
    name: 'alan', 
    age: 21,
    admin: false,
    copyright: 'Template engine 2024'
})

console.log(compiled)