const fs = require('fs');
const path = require('path')
const crypto = require('crypto');

class Template {

    DELIMITERS = {
        OPEN: '<%',
        CLOSE: '%>',
        OUTPUT: '<%='
    }

    DEFAULT_EXTENSION = '.tem'

    fileName = ''
    dirName = ''

    regexDelimiter = new RegExp(/(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)/)

    compile(template, data) {
        const parsedTemplate = this.generateSource(this.parse(template))
        const src = `let { ${Object.keys(data).join(', ')} } = data;\n ${parsedTemplate}`

        const fn = new Function('data', src)

        return fn(data)
    }

    renderFile(fileName, data) {
        this.fileName = path.basename(fileName)
        this.dirName = path.dirname(fileName) + '/'

        const cachedTemplate = this.getCached()

        if (cachedTemplate !== false)
            return cachedTemplate

        const template = fs.readFileSync(`${fileName}${this.DEFAULT_EXTENSION}`).toString()
        const compiled = this.compile(template, data)
        
        this.cacheResult(compiled)

        return compiled
    }

    parse(template) {
        const tokens = []

        let includePos
        const includeRegex = new RegExp(/<%.*include\((.*)\).*%>/gm) // better to identify line breaks

        while (includePos = includeRegex.exec(template)) {
            let partialTemplate = ''
            const pathToPartial = `${this.dirName}${includePos[1]}${this.DEFAULT_EXTENSION}`

            if (fs.existsSync(pathToPartial))
                partialTemplate = fs.readFileSync(pathToPartial).toString()

            template = template.replace(includePos[0], partialTemplate)
        }

        let result = this.regexDelimiter.exec(template)

        while (result) {
            let delimiterPos = result.index
            let delimiterChar = result[0]

            if (delimiterPos !== 0) {
                tokens.push(template.substring(0, delimiterPos))
                template = template.substring(delimiterPos)
            }

            tokens.push(delimiterChar)
            template = template.slice(delimiterChar.length)
            result = this.regexDelimiter.exec(template)
        }

        if (template)
            tokens.push(template)

        return tokens
    }

    generateSource(tokens) {
        const prepend = "var __output = '';\n function __append(str) { if (str !== undefined && str !== null) __output += str }\n\n try {\n"
        let src = ''
        const append = "return __output;\n} catch (e) {\nthrow new Error(e)\n}"

        for (let index = 0; index < tokens.length; index++) {
            const isOpen = tokens[index] === this.DELIMITERS.OPEN
            const isOutput = tokens[index] === this.DELIMITERS.OUTPUT
            const isHTML = !isOpen && !isOutput

            if (isOpen || isOutput) {
                if (tokens[index + 2] !== this.DELIMITERS.CLOSE) {
                    throw new Error("Não foi encontrado fechamento de delimitador")
                }
            }

            if (isOpen) {
                src += tokens[index + 1] + '\n '
                index += 2
            }

            if (isOutput) {
                src += '__append(' + tokens[index + 1] + ');\n '
                index += 2
            }

            if (isHTML) {
                src += '__append(`' + tokens[index] + '`);\n '
            }

        }


        return prepend + src + append
    }

    cacheResult(html) {
        if (!fs.existsSync('cache/')) {
            fs.mkdirSync('cache')
        }

        const newFileName = crypto.createHash('md5').update(this.fileName).digest('hex')

        fs.writeFile(`cache/${newFileName}.html`, html, (err) => {
            if (err)
                throw new Error('Template não foi cacheado')
        })
    }

    getCached() {
        if (!fs.existsSync('cache/')) {
            return false
        }

        const newFileMd5 = crypto.createHash('md5').update(this.fileName).digest('hex')

        const isCached = fs.readdirSync('cache/').filter(file => {
            return file.split('.')[0] === newFileMd5
        })
        
        if (isCached.length > 0) {
            const pathToCachedTemplate = `cache/${newFileMd5}.html`

            const cachedStatus = fs.statSync(pathToCachedTemplate)
            const currentFileStatus = fs.statSync(`${this.dirName}${this.fileName}${this.DEFAULT_EXTENSION}`)

            if (currentFileStatus.mtimeMs > cachedStatus.mtimeMs) { // original template has been modified
                return false
            }

            return fs.readFileSync(pathToCachedTemplate).toString()
        }
        
        return false
    }
}

exports.Template = Template