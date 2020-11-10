require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
var cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

/* 
  POST
{
  name: string,
  address: string,
  age: int,
  username: string,
  password: string
}
*/
app.post('/user', authenticateToken, async (req, res) => {
  const hashedPasswd = await bcrypt.hash(req.body.password, 10);
  const user = {
    name: req.body.name,
    address: req.body.address,
    age: parseInt(req.body.age, 10),
    username: req.body.username,
    password: hashedPasswd,
    role: user.role
  }

  insert(user)
    .then(user => {
      res.status(201).json({
        "message": "Usuário criado com sucesso",
        "content": {
          "user": userDTOFrom(user)
        },
        "error": null
      }
    );
  })
  .catch(err => {
    res.status(500).json({
      "message": "Ocorreu um erro interno",
      "content": null,
      "error": err.message
    });
  });
});

/*
  GET
*/
app.get('/user', authenticateToken, async (req, res) => {
  let id = req.query.id;

  if(id) {
    getUser(id)
      .then(user => {
        res.status(200).json({
          "message": "Usuário encontrado",
          "content": {
            "user": userDTOFrom(user)
          },
          "error": null
        }
      );
    })
    .catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    });

  } else {
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
        }
      );
    })
    .catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    });
  }
});

/*
  PUT
  {
    name: string,
    address: string,
    age: int,
    username: string,
    password: string
  }
*/
app.put('/user', authenticateToken, async (req, res) => {
  const hashedPasswd = await bcrypt.hash(req.body.password, 10);
  const user = {
    name: req.body.name,
    address: req.body.address,
    age: parseInt(req.body.age, 10),
    username: req.body.username,
    password: hashedPasswd,
    role: user.role
  }

  updateUser(user)
    .then(user => {
      res.status(201).json({
        "message": "Usuário atualizado com sucesso",
        "content": {
          "user": userDTOFrom(user)
        },
        "error": null
      }
    );
  })
  .catch(err => {
    res.status(500).json({
      "message": "Ocorreu um erro interno",
      "content": null,
      "error": err.message
    });
  });
});

/*
  DELETE
*/
app.delete('/user', authenticateToken, async (req, res) => {
  let id = req.query.id;
  deleteUser(id)
    .then(success => {
      res.status(201).json({
        "message": "Usuário atualizado com sucesso",
        "content": success,
        "error": null
      }
    );
  }).catch(err => {
    res.status(500).json({
      "message": "Ocorreu um erro interno",
      "content": null,
      "error": err.message
    });
  });
});

/** TICKET */
/* 
  POST
{
  userId: number,
  description: string
}
*/
app.post('/ticket', authenticateToken, async (req, res) => {
  const ticket = {
    user_id: req.body.user_id,
    description: req.body.description
  }
  
  insertTicket(ticket)
    .then(response => {
      res.status(200).json({
        "message": "Chamado criado com sucesso",
        "content": {
          "ticket": response
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

/** 
 * GET */
app.get('/ticket', authenticateToken, async (req, res) => {
  let id = req.query.id;

  if(id) {
    const ticketsDto = [];

    getAllTickets(id)
      .then(tickets => {
        tickets.forEach(ticket => ticketsDto.push(ticket));
        res.status(200).json({
          "message": "Chamados encontrados",
          "content": {
            "users": ticketsDto
          },
          "error": null
        }
      );
    })
    .catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    });
  } else {
    res.status(500).json({
      "message": "Erro ao encontrar chamados",
      "content": null,
      "error": "user ID missing from query param"
    });
  }
});

/** DELETE */
app.delete('/ticket', authenticateToken, async (req, res) => {
  let id = req.query.id;

  if(id) {
    deleteTicket(id)
      .then(success => {
        res.status(201).json({
          "message": "Chamado excluído com sucesso",
          "content": success,
          "error": null
        }
      );
    }).catch(err => {
      res.status(500).json({
        "message": "Ocorreu um erro interno",
        "content": null,
        "error": err.message
      });
    });

  } else {
    res.status(500).json({
      "message": "Erro ao encontrar chamado",
      "content": null,
      "error": "user ID missing from query param"
    });

  }
});

/** PUT 
 * {
    description: string
   }
*/
app.put('/ticket', authenticateToken, async (req, res) => {
  const ticket = {
    description: req.body.description
  }

  updateTicket(ticket)
    .then(ticket => {
      res.status(201).json({
        "message": "Chamado atualizado com sucesso",
        "content": {
          "user": ticket
        },
        "error": null
      }
    );
  })
  .catch(err => {
    res.status(500).json({
      "message": "Ocorreu um erro interno",
      "content": null,
      "error": err.message
    });
  });
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
        
        const accessToken = generateToken(
          { 
            id: user.id, 
            name: user.name, 
            username: user.username 
          }
        );
        
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
      address: 'Rua do Usuário',
      age: '50',
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
      address: 'Rua do Admin',
      age: '000',
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
  db.get("PRAGMA foreign_keys = ON");
  
  db.run(`CREATE TABLE user(
    user_id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    address TEXT, 
    age INTEGER, 
    username TEXT NOT NULL, 
    password TEXT NOT NULL, 
    token TEXT,
    role TEXT);`
  );

  db.run(`CREATE TABLE ticket(
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT, 
    user_id INTEGER INTEGER REFERENCES user(user_id), 
    description TEXT);`
  );
  
  console.log('Tables has been created');
}

/** USER */

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
    db.get(`SELECT * FROM user WHERE user_id = ?`, [id], (err, row) => {
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
   
  let options = [
    usr.name, 
    usr.username, 
    usr.address, 
    usr.age,
    usr.password, 
    usr.token, 
    usr.role, 
    id];  

  return new Promise((resolve, reject) => { 
    db.run(
      `UPDATE user SET 
         name = COALESCE(?,name), 
         address = COALESCE(?,address), 
         age = COALESCE(?,age), 
         username = COALESCE(?,username), 
         password = COALESCE(?,password),
         token = COALESCE(?,token),
         role = COALESCE(?,role)
      WHERE user_id = ?`, options, (err, result) => {
        
      if (err){
        throw err;
      }  
      resolve(result);
    });
  });
}

function deleteUser(id) { 
  return new Promise((resolve, reject) => { 
    db.run(
      `DELETE FROM user
        WHERE user_id = ?`, id, (err, result) => {
        
      if (err){
        throw err;
      }  
      resolve(result);
    });
  });
}

/** TICKET */
function getAllTickets(userId) {
  const tickets = [];
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM ticket
        WHERE user_id = ?`, userId, (err, rows) => {

      if (err) {
        console.log(err.message);  
        throw err;
      }

      rows.forEach((row) => {
        tickets.push(row);
      });  
      resolve(users);
    });
  });
}

function insertTicket(ticket) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO ticket(user_id,description) VALUES(?,?)`, 
      [ticket.user_id, ticket.description], err => {
      
      if(err) {
        console.log(err.message);
        throw err
      }
      resolve(ticket);
    });
  });
}

function updateTicket(ticket) { 
  let id = ticket.user_id;
   
  let options = [
    ticket.description, 
    id
  ];  

  return new Promise((resolve, reject) => { 
    db.run(
      `UPDATE ticket SET 
         description = COALESCE(?,address)
      WHERE user_id = ?`, options, (err, result) => {
        
      if (err){
        throw err;
      }  
      resolve(result);
    });
  });
}

function deleteTicket(id) { 
  return new Promise((resolve, reject) => { 
    db.run(
      `DELETE FROM ticket
        WHERE ticket_id = ?`, id, (err, result) => {
        
      if (err){
        throw err;
      }  
      resolve(result);
    });
  });
}

// Start Server
var port = process.env.PORT || 3000;

app.listen(port);

//Helpers
function userDTOFrom(user) {
  return {
    id: user.id,
    name: user.name,
    address: user.address,
    age: user.age,
    username: user.username,
    role: user.role
  }
}