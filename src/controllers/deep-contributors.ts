import { Request, Response } from 'express';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

export function findDeepContributors(req: Request, res: Response) {
    const { path } = req.query;
    if(!path){
        res.status(StatusCodes.BAD_REQUEST).send(ReasonPhrases.BAD_REQUEST);
        return;
    }
    console.log(path)
    // res.send('Hello World!')
    res
    .status(StatusCodes.OK)
    .json({data: 'test'});
}