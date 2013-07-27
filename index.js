var async = require('async')
  , events = require('events')
  , firmata = require('firmata')
  , log4js = require('log4js')
  , microtime = require('microtime')
  , serialport = require('serialport')
  , Q = require('q')

var rport = /usb|acm|com/i
  , logger = log4js.getLogger('nodebot')

var bootstrap = []
  , app = {}

// find available ports
bootstrap.push(function(cb) {
  logger.info('finding serial ports...')
  serialport.list(function(err, ports) {
    if (err) {
      return cb(err)
    }
    ports = ports.filter(function(port) {
      return rport.test(port.comName)
    }).map(function(port) {
      return port.comName
    })
    logger.info('found ' + ports.length + ' devices')
    app.ports = ports
    cb()
  })
})

// attach to first successful port
bootstrap.push(function(cb) {
  async.reduce(app.ports, null, function(board, port, cb) {
    if (board)
      return cb(null, board)
    logger.info('attempting to attach to ' + port)
    board = new firmata.Board(port, {reportVersionTimeout: 5000}, function(err) {
      if (err)
        return cb(null, null)
      cb(null, board)
    })
  }, function(err, board) {
    if (err) {
      return cb(err)
    }
    if (!board) {
      return cb(new Error('unable to attach to arduino device'))
    }
    app.board = board
    cb()
  })
})

async.series(bootstrap, function(err) {
  if (err)
    return logger.error(err)
  logger.info('attached to arduino')
  var board = app.board

  board.pinMode(5, board.MODES.INPUT)
  board.pinMode(4, board.MODES.OUTPUT)
  board.pinMode(3, board.MODES.INPUT)

  var distance = new events.EventEmitter()
  distance.setMaxListeners(0)

  var inState = 0
    , start = microtime.now()
    , end = microtime.now()
  board.digitalRead(5, function(state) {
    // low to high
    if (inState === 0 && state === 1) {
      start = microtime.now()
    } 
    // high to low
    else if (inState === 1 && state === 0) {
      end = microtime.now()
      distance.emit('distance', end - start)
    }
    inState = state
  })

  distances = []
  distance.on('distance', function(d) {
    distances.push(d)
    distances = distances.slice(-10)
  })
  setInterval(function() {
    var total = distances.reduce(function(m, c) { return m + c }, 0)
      , avg = distances.length ? total / distances.length : 0

    console.log('avg', avg)
  }, 500)
  board.digitalWrite(4, board.LOW)
  pulse = function() {
    var deferDistance = Q.defer()
      , deferPulse = Q.defer()
      , promise = 

    distance.once('distance', deferDistance.resolve)
    board.digitalWrite(4, board.HIGH)
    setTimeout(function() {
      board.digitalWrite(4, board.LOW)
      setTimeout(deferPulse.resolve, 2)
    }, 2)
    Q.all([deferDistance, deferPulse]).then(function() {
      setTimeout(pulse, 25)
    })
  }
  pulse()
})