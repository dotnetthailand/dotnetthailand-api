import express from 'express';
import { findDeepContributors } from './controllers/deep-contributors';

const app = express()

app.get('/find-deep-contributors', findDeepContributors);

app.listen(3000);