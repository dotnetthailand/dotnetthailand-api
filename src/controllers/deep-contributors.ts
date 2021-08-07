import { Request, Response } from 'express';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import { fetchContributors, fetchDeepContributors, IAuthorInfo } from '../libs';

export async function findDeepContributors(req: Request, res: Response) {
    const { path } = req.query;
    if (!path) {
        res.status(StatusCodes.BAD_REQUEST).send(ReasonPhrases.BAD_REQUEST);
        return;
    }
    console.log(path);
    const contentPath = (path as string).replace(/(^\/)/g, '');
    let authors: IAuthorInfo[] = [];
    const result = await fetchContributors(contentPath, authors);
    authors = result.authors;
    const deepSearch = result.deepSearch;

    console.log(deepSearch)
    for (let i = 0; i < deepSearch.length; i++) {
        authors = await fetchDeepContributors(contentPath, deepSearch[i]?.previousFilename, deepSearch[i]?.commitSha, authors, 1);
        console.log(authors);
    };

    res
        .status(StatusCodes.OK)
        .json({
            path: contentPath,
            data: authors
        });
}