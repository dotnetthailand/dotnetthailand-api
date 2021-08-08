import express from 'express';
import fs from 'fs';
import path from 'path';
import { findDeepContributors } from './controllers/deepContributors';
import apicache from 'apicache'
import morgan from 'morgan';

// import cache from './middlewares/cache';

let cache = apicache.middleware

const app = express()

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

// setup the logger
app.use(morgan('combined', { stream: accessLogStream }))

app.get('/find-deep-contributors', findDeepContributors);

app.listen(3000);