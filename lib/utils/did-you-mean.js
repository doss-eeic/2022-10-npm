const { distance } = require('fastest-levenshtein')
const readJson = require('read-package-json-fast')
const { commands } = require('./cmd-list.js')
const Npm = require('../npm.js')
const _npm = new Npm()

const readUserInput = (question) => {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      resolve(answer)
      readline.close()
    })
  })
}

const extractCommand = (extendedCommands, idx = 0) => {
  return extendedCommands[idx].split(' ')[5]
}

const didYouMean = async (npm, path, scmd, rawArgs) => {
  const errTolerance = 0.6 // defalt: 0.4
  // const cmd = await npm.cmd(str)
  const close = commands.filter(
    (cmd) => distance(scmd, cmd) < scmd.length * errTolerance && scmd !== cmd
  )
  let best = []
  for (const str of close) {
    const cmd = await npm.cmd(str)
    best.push(`    npm ${str} ${rawArgs.join(' ')} # ${cmd.description}`)
  }
  // We would already be suggesting this in `npm x` so omit them here
  const runScripts = ['stop', 'start', 'test', 'restart']
  try {
    const { bin, scripts } = await readJson(`${path}/package.json`)
    best = best.concat(
      Object.keys(scripts || {})
        .filter(
          (cmd) =>
            distance(scmd, cmd) < scmd.length * errTolerance &&
            !runScripts.includes(cmd)
        )
        .map((str) => `    npm run ${str} # run the "${str}" package script`),
      Object.keys(bin || {})
        .filter((cmd) => distance(scmd, cmd) < scmd.length * errTolerance)
        /* eslint-disable-next-line max-len */
        .map(
          (str) =>
            `   npm exec ${str} # run the "${str}" command from either this or a remote npm package`
        )
    )
  } catch (_) {
    // gracefully ignore not being in a folder w/ a package.json
  }

  if (best.length === 0) {
    npm.output('To see a list of supported npm commands, run:\n  npm help')
  } else if (best.length === 1) {
    npm.output(
      `\n\nDid you mean this?$ --- npm ${extractCommand(
        best
      )}\n\nPress y to run:\n${best[0]}`
    )

    const inputChar = await readUserInput('')
    const yesList = { y: 'a', Y: 'b', yes: 'c', Yes: 'd', YES: 'e' }
    if (inputChar in yesList) {
      await npm.exec(extractCommand(best), npm.argv)
    } else {
      npm.output('To see a list of supported npm commands, run:\n  npm help')
    }
  } else {
    const numBest = best.length
    npm.output('\n\nDid you mean one of these?')
    for (let i = 0; i < numBest; ++i) {
      npm.output(` ${i + 1}.${best[i]}`)
    }
    npm.output(`\nPress 1 - ${numBest} to run one of them`)

    const inputNum = Number(await readUserInput(''))
    if (inputNum >= 0 && inputNum <= numBest) {
      await npm.exec(extractCommand(best, inputNum - 1), npm.argv)
    } else {
      npm.output('To see a list of supported npm commands, run:\n  npm help')
    }
  }
}
module.exports = didYouMean
