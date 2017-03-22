// declare all our variables
const WIDTH = 720
const HEIGHT = 480
const GROUNDHEIGHT = HEIGHT - 40
const GRAVITY = -1
const GAMESPEED = 1.5
const WINSCORE = 1000
const TILESPEEDS = {
  ground: 0.25,
  backdrop: 0.1
}

const canvas = document.querySelector('#game')
canvas.width = WIDTH
canvas.height = HEIGHT

const ctx = canvas.getContext('2d')

const imgLoader = createImageLoader()

const playerAnimations = Object.assign({},
  createAnimation('run', 'images/kenny/run', 6, 7),
  createAnimation('idle', 'images/kenny/idle', 2, 25),
  createAnimation('jump', 'images/kenny/jump', 1, 0, false),
  createAnimation('fall', 'images/kenny/fall', 1, 0, false),
  createAnimation('dead', 'images/kenny/hit', 1, 0, false)
)

const groundImage = imgLoader.loadImage('images/background/tile.png')
const holeImage = imgLoader.loadImage('images/background/hole.png')
const obstacleImages = [
    imgLoader.loadImage('images/obstacles/cactus.png'),
    imgLoader.loadImage('images/obstacles/spikes.png')
  ]
const backdropImage = imgLoader.loadImage('images/background/backdrop.png')

imgLoader.loadAll()
  .then(() => { loaded() })

let gameLoaded = false
let prevLoop
let keysPressed = []
let player
let score
let ground
let backdrop

if (!window.location.href.endsWith('?skip-intro'))
  document.querySelector('#game-intro').className = 'show'

function loaded() {
  gameLoaded = true

  if (window.location.href.endsWith('?skip-intro'))
    gameStart()
}

// create an image loader that will use promises to load all of the given images
function createImageLoader() {
  let l = {}
  l.images = []

  l.loadImage = (src) => {
    let img = new Image()
    img.src = src

    let p = new Promise((resolve, reject) => {
      img.addEventListener('load', () => { resolve(img) })
      img.addEventListener('error', (err) => { reject(new Error('Image failed to load')) })
    })

    l.images.push(p)

    return img
  }

  l.loadAll = () => {
    return Promise.all(l.images)
      .then((images) => l.images = images)
      .catch((error) => { console.error(error) })
  }

  return l
}

// make an animation object with our parameters and loaded animation frames
function createAnimation(name, path, length, time, loop = true) {
  let a = {}
  a[name] = {}

  a[name].frames = new Array(length).fill(null).map((val, indx) => imgLoader.loadImage(`${path}/${indx}.png`))
  a[name].frameTime = time
  a[name].loop = loop

  return a
}

// make a player object that will animate and jump
function createPlayer(animations, x, scale = 1) {
  let p = {}

  p.state = 'run'
  p.prevState = p.state

  p.frame = 0
  p.frameTicks = 0
  p.animations = animations

  p.frameTime = p.animations[p.state].frameTime
  p.image = p.animations[p.state]['frames'][p.frame]

  p.scale = scale
  p.width = p.image.width * p.scale
  p.height = p.image.height * p.scale
  p.x = x
  p.y = GROUNDHEIGHT - p.height
  p.prevBottom = GROUNDHEIGHT

  p.vel = 0
  p.forces = 0
  p.mass = 200

  p.score = 0

  p.getRight = () => {
    return p.x + p.width
  }

  p.getBottom = () => {
    return p.y + p.height
  }

  p.updateImage = () => {
    const bottom = p.getBottom()
    p.image = p.animations[p.state]['frames'][p.frame]
    p.width = p.image.width * p.scale
    p.height = p.image.height * p.scale
    p.y = bottom - p.height
  }

  p.updateAnimation = (delta) => {
    p.frameTicks += 0.06 * delta

    if ((p.animations[p.state].loop || p.frame < p.animations[p.state]['frames'].length - 1) && p.frameTicks >= p.frameTime) {
      p.frame++
      p.frameTicks = 0

      if (p.frame === p.animations[p.state]['frames'].length)
        p.frame = 0

      p.updateImage()
    }
  }

  p.setState = (state) => {
    if (state === p.state || p.state === 'dead') return

    p.frame = 0
    p.frameTicks = 0
    p.state = state
    p.frameTime = p.animations[p.state].frameTime

    p.updateImage()
  }

  p.addForce = (amount) => {
    p.forces += amount
  }

  p.jump = () => {
    if (p.state === 'run' || p.state === 'idle') {
      p.prevState = p.state
      p.addForce(500)
    }
  }

  p.checkGround = (delta) => {
    const groundCollisions = ground.tiles.filter((val) =>
      val.type === 'ground' &&
      p.x < val.getRight() &&
      p.getRight() > val.x &&
      p.prevBottom <= val.y &&
      p.getBottom() >= val.y &&
      p.y < val.y
    )

    return groundCollisions
  }

  p.simulatePhysics = (delta) => {
    const dt = !p.vel ? 1 : delta
    p.addForce(GRAVITY)

    p.prevBottom = p.getBottom()

    const acceleration = p.forces / p.mass
    p.y -= dt * (p.vel + dt * acceleration / 2)

    const nextAcceleration = GRAVITY / p.mass
    p.vel += dt * (acceleration + nextAcceleration) / 2

    p.forces = 0

    const onGroundTiles = p.checkGround(delta)

    if (onGroundTiles.length && p.getBottom() !== onGroundTiles[0].y) {
      p.setState(p.prevState)
      p.y = onGroundTiles[0].y - p.height
      if (p.vel < 0)
        p.vel = 0
    }
  }

  p.handleCollisions = () => {
    const obstacleCollisions = ground.obstacleTiles.filter((val) =>
      p.x < val.getRight() &&
      p.getRight() > val.x &&
      p.y < val.getBottom() &&
      p.getBottom() > val.y
    )

    if (obstacleCollisions.length)
      p.setState('dead')
  }

  p.update = (delta) => {
    if (p.state === 'dead') return

    p.score += 0.0125 * delta * GAMESPEED

    p.simulatePhysics(delta)
    p.handleCollisions()

    if (p.vel > 0)
      p.setState('jump')

    if (p.vel < 0)
      p.setState('fall')

    if (p.y > HEIGHT)
      p.setState('dead')

    if (p.score >= WINSCORE)
      document.querySelector('#game-win').className = 'show'

    else if (p.state === 'dead') {
      document.querySelector('#game-over-score').innerHTML += p.score.toFixed(0)
      document.querySelector('#game-over').className = 'show'
    }

    p.updateAnimation(delta)
  }

  p.draw = () => {
    ctx.drawImage(p.image, p.x, p.y, p.width, p.height)
  }

  return p
}

// create a score object which will update and draw each frame
function createScore(player, font, size, color, x, y) {
  let s = {}

  s.player = player
  s.text = 'Score: ' + parseInt(s.player.score)
  s.font = font
  s.size = size
  s.color = color
  s.x = x
  s.y = y

  s.update = () => {
    s.text = 'Score: ' + parseInt(s.player.score)
  }

  s.draw = () => {
    ctx.font = `${size}px ${font}`
    ctx.fillStyle = s.color
    ctx.textBaseline = 'hanging'
    ctx.fillText(s.text, s.x, s.y)
  }

  return s
}

// create an image tile with the given size and coordinates
function createTile(image, x, y, width, height, type, speed) {
  let t = {}

  t.type = type

  t.speed = speed
  t.image = image
  t.x = x
  t.y = y
  t.width = width
  t.height = height

  t.getRight = () => {
    return t.x + t.width
  }

  t.getBottom = () => {
    return t.y + t.height
  }

  t.update = (delta) => {
    t.x -= t.speed * GAMESPEED * delta

    if (t.getRight() < 0)
      return false

    return true
  }

  t.draw = () => {
    ctx.drawImage(t.image, t.x, t.y, t.width, t.height)
  }

  return t
}

// create moving ground tiles with a chance of obstacles
function createGround(image, holeImage, obstacleImages) {
  let g = {}

  g.height = HEIGHT - GROUNDHEIGHT
  g.y = GROUNDHEIGHT

  g.speed = TILESPEEDS.ground
  g.image = image
  g.tileWidth = image.width * (g.height / image.height)
  g.tileAmount = Math.ceil(WIDTH / g.tileWidth) + 1
  g.tiles = new Array(g.tileAmount).fill(null).map((val, index) =>
    createTile(image, index * g.tileWidth, g.y, g.tileWidth, g.height, 'ground', g.speed)
  )
  g.obstacleTiles = []

  g.obstacleChance = 9
  g.obstacleDistance = 6
  g.lastObstacleTile = g.tiles.length

  g.obstacleImages = obstacleImages
  g.holeImage = holeImage
  g.holeLength = 3

  g.spawnHole = (length = 0) => {
    if (length === g.holeLength) return
    const x = g.tiles[g.tiles.length - 1].getRight()
    g.tiles[g.tiles.length] = createTile(g.holeImage, x, g.y, g.tileWidth, g.height, 'hole', g.speed)
    g.spawnHole(length + 1)
  }

  g.spawnSprite = (image) => {
    const x = g.tiles[g.tiles.length - 1].getRight()
    const height = image.height * (g.tileWidth / image.width)
    g.obstacleTiles[g.obstacleTiles.length] = createTile(image, x, g.y - height, g.tileWidth, height, 'obstacle', g.speed)
  }

  g.update = (delta) => {
    let shiftTiles = false
    g.tiles.forEach((val) => {
      if (!val.update(delta)) shiftTiles = true
    })

    if (player.score <= WINSCORE) {
      g.obstacleChance = Math.ceil(WINSCORE / player.score)
    }

    if (shiftTiles) {
      g.tiles.shift()

      const x = g.tiles[g.tiles.length - 1].getRight()
      g.tiles[g.tiles.length] = createTile(g.image, x, g.y, g.tileWidth, g.height, 'ground', g.speed)

      if (g.lastObstacleTile > g.obstacleDistance && Math.floor(Math.random() * (g.obstacleChance + 1)) === g.obstacleChance) {
        g.lastObstacleTile = 0
        g.tiles.length = g.tileAmount

        const obstacles = [g.spawnHole]
        g.obstacleImages.forEach((img) => {
          obstacles.push(g.spawnSprite.bind(null, img))
        })
        obstacles[Math.floor(Math.random() * obstacles.length)]()
      }

      g.lastObstacleTile++
    }

    let shiftObstacles = false
    g.obstacleTiles.forEach((val) => {
      if (!val.update(delta)) shiftObstacles = true
    })

    if (shiftObstacles)
      g.obstacleTiles.shift()
  }

  g.draw = () => {

    g.tiles.forEach((val) => {
      val.draw()
    })

    g.obstacleTiles.forEach((val) => {
      val.draw()
    })
  }

  return g
}

// create a backdrop for our game
function createBackdrop(image) {
  let b = {}

  b.x = 0
  b.y = 0
  b.width = image.width * (HEIGHT / image.height)
  b.height = HEIGHT

  b.speed = TILESPEEDS.backdrop
  b.image = image
  b.tiles = new Array(Math.ceil(WIDTH / b.width) + 1).fill(null).map((val, index) =>
    createTile(b.image, index * b.width, b.y, b.width, b.height, 'backdrop', b.speed)
  )

  b.update = (delta) => {
    let shiftTiles = false
    b.tiles.forEach((val) => {
      if (!val.update(delta)) shiftTiles = true
    })


    if (shiftTiles) {
      b.tiles.shift()

      const x = b.tiles[b.tiles.length - 1].getRight()
      b.tiles[b.tiles.length] = createTile(b.image, x, b.y, b.width, b.height, 'backdrop', b.speed)
    }
  }

  b.draw = () => {
    b.tiles.forEach((val, index) => {
      val.draw()
    })
  }

  return b
}

// when all images have loaded, create our needed objects and start drawing
function gameStart() {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  player = createPlayer(playerAnimations, 100, 0.1)
  score = createScore(player, 'Roboto', 32, 'black', 25, 25)
  ground = createGround(groundImage, holeImage, obstacleImages)
  backdrop = createBackdrop(backdropImage)

  prevLoop = performance.now()
  window.requestAnimationFrame(gameLoop)

  document.querySelector('#game-intro').className = 'hide'

  document.addEventListener('keydown', (e) => {
    const key = e.key

    if (!keysPressed.includes(key))
      keysPressed.push(key)
  })

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()

    player.jump()
  })
}

// update all our game objects
function update(delta) {
  if (keysPressed.includes(' '))
    player.jump()

  keysPressed = []

  backdrop.update(delta)
  ground.update(delta)
  player.update(delta)
  score.update()
}

// clear the areas that were drawn last frame and draw updated objects
function draw() {
  backdrop.draw()
  ground.draw()
  player.draw()
  score.draw()
}

// sync our game loop to the window framerate, then update and draw each frame
function gameLoop(time) {
  const delta = time - prevLoop
  prevLoop = time

  update(delta)
  draw()

  window.requestAnimationFrame(gameLoop)
}
