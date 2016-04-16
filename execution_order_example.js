/*
 * This file is simply here as a refactoring guide for how to split up the
 * different actions.
 *
 * Please ignore
 */

const funcOne = (args) => {
  console.log('One got args ', args)
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Resolving One!')
      resolve('one')
    }, 200)
  })
}

const funcTwo = (args) => {
  console.log('Two got args ', args)
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Resolving Two!')
      resolve('two')
    }, 500)
  })
}

const funcThree = (args) => {
  console.log('Three got args ', args)
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Resolving Three!')
      resolve('three')
    }, 500)
  })
}

const funcFaultyFour = (args) => {
  console.log('Four got args ', args)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject('dammmmmit')
    }, 1000)
  })
}

const createSeqFunc = (func, msg) => {
  return {func, msg}
}

const functions = [
  createSeqFunc(funcOne, 'Function one yay!'),
  createSeqFunc(funcTwo, 'Functiono TWO'),
  createSeqFunc(funcThree, 'Last and smallest'),
  createSeqFunc(funcFaultyFour, 'Maybe this will break')
]

const executeFunctions = (funcs, args, callback) => {
  const funcToExec = funcs[0].func
  const msgToLog = funcs[0].msg
  console.log(msgToLog)
  funcToExec(args).then((res) => {
    if (funcs.length === 0) {
      callback()
      return
    }
    executeFunctions(funcs.splice(1), res)
  }).catch((err) => {
    console.log('Something baaaaaaaaaaaaaaaaaaaaaaaaad happened')
    console.log(err)
  })
}

executeFunctions(functions, undefined, () => {
  console.log('All functions done eh')
})
