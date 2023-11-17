import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client'
import { Server } from 'socket.io';
import { createServer } from 'node:http'




dotenv.config()

const express = require('express');
const app = express();
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {}
})


const db = createClient({
  url: "libsql://topical-nighthawk-glewsy.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOiIyMDIzLTExLTE3VDAxOjQzOjI3LjA3OTU2NjQzOFoiLCJpZCI6Ijc1OTk5YTBhLTgwZmItMTFlZS05ZTUxLWNlZTVhNmVjZDg4NCJ9.zy1On3XHhwbk6qJWVoEyuVLSDoGr047zCsl5qqL--WSBjhkEcc-cTSi25vZFjmv1XgRSVCe1mATWXPimPsrmCg"
})

await db.execute(`
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  user TEXT
)
`)

app.use(logger('dev'))
app.use(express.static('./client'));

io.on('connection', async (socket) => {
  socket.on('disconnect', () => {
    console.log('an user has disconnected!')
  })
  socket.on('chat message', async (msg) => {
    let result
    const username = socket.handshake.auth.username ?? 'anonymous'
    try {


      result = await db.execute({
        sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
        args: { msg, username }
        
      })
    } catch (e) {
      console.error(e)
      return
    }
    io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    console.log('Enviando mensaje a la base de datos "turso":', msg, username);

  })



  if (!socket.recovered) {
    try {
      const results = await db.execute({
        sql: 'SELECT id, content, user FROM messages WHERE id > ?',
        args: [socket.handshake.auth.serverOffset ?? 0]
      })

      results.rows.forEach(row => {
        socket.emit('chat message', row.content, row.id.toString(), row.user)
      })
    } catch (e){
      console.error(e)
      return
    }
  }
})

const puerto = 3000;
server.listen(puerto, () => {
  console.log(`La aplicación está escuchando en el puerto ${puerto}`);
});

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
});