const { distance } = require('fastest-levenshtein')
const readJson = require('read-package-json-fast')
const { commands } = require('./cmd-list.js')


const readUserInput = question => {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

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


const didYouMean = async (npm, path, scmd) => {
  const errTolerance = 0.8  //defalt: 0.4
  // const cmd = await npm.cmd(str)
  const close = commands.filter(cmd => distance(scmd, cmd) < scmd.length * errTolerance && scmd !== cmd)
  let best = []
  for (const str of close) {
    const cmd = await npm.cmd(str)
    best.push(`    npm ${str} # ${cmd.description}`)
  }
  // We would already be suggesting this in `npm x` so omit them here
  const runScripts = ['stop', 'start', 'test', 'restart']
  try {
    const { bin, scripts } = await readJson(`${path}/package.json`)
    best = best.concat(
      Object.keys(scripts || {})
        .filter(cmd => distance(scmd, cmd) < scmd.length * errTolerance && !runScripts.includes(cmd))
        .map(str => `    npm run ${str} # run the "${str}" package script`),
      Object.keys(bin || {})
        .filter(cmd => distance(scmd, cmd) < scmd.length * errTolerance)
        /* eslint-disable-next-line max-len */
        .map(str => `    npm exec ${str} # run the "${str}" command from either this or a remote npm package`)
    )
  } catch (_) {
    // gracefully ignore not being in a folder w/ a package.json
  }

  const Npm = require('../npm.js')
  const _npm = new Npm()
  const readline = require('readline')

  if (best.length === 0) {
    return
  } else if (best.length === 1){
    _npm.output(`\n\nDid you mean this?$ --- npm ${extractCommand(best)}\n\nPress y to run:\n${best[0]}`)

    const inputChar = await readUserInput('')
    if (inputChar === 'y') {
      await _npm.exec(extractCommand(best), [])
    } else {
      npm.output('To see a list of supported npm commands, run:\n  npm help')
    }
  } else {
    const numBest = best.length;
    _npm.output('\n\nDid you mean one of these?')
    for (let i = 0; i < numBest; ++i) _npm.output(` ${i + 1}.${best[i]}`)
    _npm.output(`\nPress 1 - ${numBest} to run one of them`)

    const inputNum = Number(await readUserInput(''))
    if (0 <= inputNum && inputNum <= numBest) {
      await _npm.exec(extractCommand(best, inputNum - 1), [])
    } else {
      npm.output('To see a list of supported npm commands, run:\n  npm help')
    }
  }


//   const suggestion =
//   best.length === 1
//   ? `\n\nDid you mean this?\n${best[0]}`
//       : `\n\nDid you mean one of these?\n${best.slice(0, 3).join('\n')}`
//   return suggestion


}
module.exports = didYouMean
