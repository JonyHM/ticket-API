require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const express = require('express');
const bcrypt = require('bcrypt');
var cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

/* 
  POST
{
  name: string,
  username: string,
  password: string
}
*/
app.post('/users', authenticateToken, async (req, res) => {
  try {
    const hashedPasswd = await bcrypt.hash(req.body.password, 10);
    const user = {
      name: req.body.name,
      username: req.body.username,
      password: hashedPasswd,
      role: user.role
    }

    insert(user)

    res.status(201).json({
      "message": "Usuário criado com sucesso",
      "content": {
        "user": userDTOFrom(user)
      },
      "error": null
    });
  } catch (err) {
    res.status(500).json({
      "message": "Ocorreu um erro interno",
      "content": null,
      "error": err.message
    });
  }
});

/*
  GET
*/
app.get('/users', authenticateToken, async (req, res) => {
  const dtos = [];

  selectAll()
    .then(users => {
      users.forEach(user => dtos.push(userDTOFrom(user)));

      res.status(200).json({
        "message": "Usuários encontrados",
        "content": {
          "users": dtos
        },
        "error": null
      });
    })
    .catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    }
  );
});

/*
  GET
*/
app.get('/score', authenticateToken, async (req, res) => {
  getScores()
    .then(scores => {
      res.status(200).json({
        "message": "Scores encontrados",
        "content": {
          "scores": scores
        },
        "error": null
      });
    })
    .catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    }
  );
});

/* 
  POST
{
  userId: number,
  percent: number
}
*/
app.post('/score', authenticateToken, async (req, res) => {
  const score = {
    userId: req.body.userId,
    name: req.body.name,
    percent: req.body.percent
  }

  console.log(score);
  
  insertScore(score)
    .then(response => {
      res.status(200).json({
        "message": "Score adicionado com sucesso",
        "content": {
          "user": response
        },
        "error": null
      });
    })
    .catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    }
  );
});

/*
{
  id: int,
  token: string
}
*/
app.post('/token', (req, res) => {
  const refreshToken = req.body.token;
  const id = req.body.id;

  getUser(id)
    .then(user => {      
      if(refreshToken === null || user.token === null) return res.sendStatus(401);
    
      if(user.token !== refreshToken) return res.sendStatus(403);
    
      jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if(err) {
          console.log(err.message);
          return res.sendStatus(403);
        }
        
        const accessToken = generateToken({ id: user.id, name: user.name, username: user.username });
        res.status(200).json({
          "message": "Token atualizado com sucesso",
          "content": {
            "accessToken": accessToken
          },
          "error": null
        });
      });
    }).catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });     
    }
  );
});

/*
{
  id: string
}
*/
app.delete('/logout', (req, res) => {
  if(req.method == "OPTIONS"){
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return
  }

  const id = req.body.id;
  getUser(id)
    .then(usr => {
      usr.token = null;
      updateUser(usr)
        .then(user => {
          res.status(200).json({
            "message": "Logout realizado com sucesso",
            "content": {
              "user": userDTOFrom(user)
            },
            "error": null
          });
        }).catch(err => {         
          res.status(500).json({
            "message": "Ocorreu um erro interno",
            "content": null,
            "error": err.message
          });
        });
    }).catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    });  
});

/*
{
  username: string,
  password: string
}
*/
app.post('/login', async (req, res) => {
  await selectUser(req.body.username)
    .then(user => {
      if(user == null) {
        res.status(400).send('Usuário não encontrado');
      }      
    
      try {
        compare(req.body.password, user.password)
        .then(equal => {
          if(equal) {
            const accessToken = generateToken(
              { 
                id: user.id, 
                name: user.name, 
                username: user.username,
                role: user.role 
              }
            );
            const refreshToken = jwt.sign(
              { 
                id: user.id, 
                name: user.name, 
                username: user.username,
                role: user.role
              }, 
              process.env.REFRESH_TOKEN_SECRET
            );
            user.token = refreshToken;
            updateUser(user);

            res.status(200).header('Authorization', accessToken).json({
              "message": "Login realizado com sucesso!",
              "content": {
                "accessToken": accessToken,
                "refreshToken": refreshToken,
                "user": userDTOFrom(user)
              },
              "error": null
            });
          } else {
            res.status(401).send('Usuário ou senha incorretos');
          }
        }).catch( err => { 
          res.status(500).json({
            "message": "Ocorreu um erro interno",
            "content": null,
            "error": err.message
          });
        });
      } catch (err) {
        res.status(500).json({
          "message": "Ocorreu um erro interno",
          "content": null,
          "error": err.message
        });
      }

    }).catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    }
  );

});

async function compare(given, actual) {
  return await bcrypt.compare(given, actual);
}

async function createUser() {
  try {
    const hashedPasswd = await bcrypt.hash('user', 10);
    const user = {
      name: 'Usuário',
      username: 'user',
      password: hashedPasswd,
      role: 'USR'
    }
    insert(user);

  } catch (err) {
    console.log(err);
  }
}

async function createAdmin() {
  try {
    const hashedPasswd = await bcrypt.hash('admin', 10);
    const user = {
      name: 'Administrador',
      username: 'admin',
      password: hashedPasswd,
      role: 'ADM'
    }
    insert(user);

  } catch (err) {
    console.log(err.message);
  }
}


// Auth
function generateToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30m' })
}

function authenticateToken(req, res, next) {  
  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.split(' ')[1] : null;  

  if(token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if(err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}


// Database

// Init
let db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the in-memory SQlite database.');
  createTables();
  createAdmin();
  createUser();
});

// DB functions
function createTables() {
  db.run(`CREATE TABLE user(
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, username TEXT NOT NULL, 
    password TEXT NOT NULL, 
    token TEXT,
    role TEXT);`
  );

  db.run(`CREATE TABLE attempt(
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL,
    userId INTEGER NOT NULL, 
    percent INTEGER NOT NULL);`
  );
  
  console.log('Tables has been created');
}

function insertScore(score) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO attempt(userId,name,percent) VALUES(?,?,?)`, 
      [score.userId, score.name, score.percent], err => {
      
      if(err) {
        console.log(err.message);
        throw err
      }
      resolve(score);
    });
  });
}

function insert(user) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO user(name,username,password,role) VALUES(?,?,?,?)`, 
      [user.name, user.username, user.password, user.role], err => {
      
      if(err) {
        console.log(err.message);
        throw err
      }
      resolve(user);
    });
  });
}

function getScores() {
  const scores = [];
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM attempt`, [], (err, rows) => {
      if (err) {
        console.log(err.message);  
        throw err;
      }
      rows.forEach((row) => {
        scores.push(row);
      });  
      resolve(scores);
    });
  });
}

function selectAll() {
  const users = [];
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM user`, [], (err, rows) => {
      if (err) {
        console.log(err.message);  
        throw err;
      }
      rows.forEach((row) => {
        users.push(row);
      });  
      resolve(users);
    });
  });
}

function selectUser(username) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM user WHERE username = ?`, [username], (err, row) => {
      if (err) {
        console.log(err.message);
        throw err;
      }      
      resolve(row);
    });
  });
}

function getUser(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM user WHERE id = ?`, [id], (err, row) => {
      if (err) {
        console.log(err.message);
        throw err;
      }      
      resolve(row);
    });
  });
}

function updateUser(usr) { 
  let id = usr.id;
   
  let options = [usr.name, usr.username, usr.password, usr.token, usr.role, id];
  console.log(options);
  

  return new Promise((resolve, reject) => { 
    db.run(
      `UPDATE user SET 
         name = COALESCE(?,name), 
         username = COALESCE(?,username), 
         password = COALESCE(?,password),
         token = COALESCE(?,token),
         role = COALESCE(?,role)
         WHERE id = ?`, options, (err, result) => {
        
      if (err){
        throw err;
      }  
      resolve(result);
    });
  });
}

// Start Server
app.listen(8080);

//Helpers
function userDTOFrom(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  }
}