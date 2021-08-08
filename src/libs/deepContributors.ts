import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const timeoutAsync = promisify(setTimeout);
const delayTime = 3; // Seconds, When fail, deplay api delayTime
const limit = 3;

const repo = 'dotnetthailand/dotnetthailand.github.io';

const setTimeoutPromise = (timeout: number) => new Promise(resolve => {        
    setTimeout(resolve, timeout);
});

const axiosConfig = {
    headers: {
        'Accept': 'application/vnd.github.v3+json'
    }
}

export interface IAuthorInfo {
    username: string;
    name: string;
    commitsCount: number;
    profileUrl: string;
    avatarUrl: string;
}

const fetchRetry = async (url: string, limit: number): Promise<any> => {
    console.log(`[limit:${limit}] Fetch from ${url}: `);
    if(limit < 0){
        console.warn(`Try to fetch '${url}' over limit`);
        return;
    }
    try {
        return axios.get(url, axiosConfig);
    } catch (e) {
        console.warn(`Something wrong: ${e}`);
        await setTimeoutPromise(delayTime * 1000);
        return fetchRetry(url, limit - 1);
    }
}

const fetchHtmlRetry = async (url: string, limit: number): Promise<string> => {
    console.log(`[limit:${limit}] Fetch from ${url}: `);
    if(limit < 0){
        console.warn(`Try to fetch '${url}' over limit`);
        return '';
    }
    try {
        const htmlResult = (await axios.get(url)).data;
        if(htmlResult.indexOf("Cannot retrieve contributors at this time") < 0)
            throw Error("Cannot retrieve contributors at this time");
        // console.log(`htmlResult: ${htmlResult}`);
        console.log('Fetch complete');
        return htmlResult;
    } catch (e) {
        console.warn(`Something wrong: ${e}`);
        await setTimeoutPromise(delayTime * 1000 * 2);
        return fetchHtmlRetry(url, limit - 1);
    }
}


const getCurrentCommitApi = (commitSha: string) => `https://api.github.com/repos/${repo}/commits/${commitSha}`;

const extractRenameAction = async (url: string, contentPath: string) => {
    console.log(`extractRenameAction: ${url}`)
    const commitOfTheFile = (await fetchRetry(url, limit)).data;
    const changedFile = commitOfTheFile.files.filter((file: any) => file.filename === `${contentPath}`)[0];
    // No rename file action, no need find more deep contributors.
    if (!changedFile?.previous_filename) {
        console.warn("No previous_filename")
        return undefined;
    }

    return changedFile?.previous_filename;
}

export const fetchContributors = async (contentPath: string, authors: IAuthorInfo[]) => {
    // One File contains multiples commit.
    const contributorsGithubAPI = `https://api.github.com/repos/${repo}/commits?path=${contentPath}`;
    const githubResponseData = (await fetchRetry(contributorsGithubAPI, limit)).data;
    console.log(contributorsGithubAPI);
    
    const result: any[] = [];
    for (let i = 0; i < githubResponseData.length; i++) {

        const username = githubResponseData[0]?.author?.login || githubResponseData[0]?.commit?.author.email;
        const indexAuthor = findAuthor(username, authors);
        if (indexAuthor > 0) {
            authors[indexAuthor].commitsCount++;
        } else {
            authors.push({
                username,
                name: githubResponseData[0]?.commit?.author.name,
                profileUrl: githubResponseData[0]?.author?.html_url || githubResponseData[0]?.html_url,
                avatarUrl: githubResponseData[0]?.author?.avatar_url,
                commitsCount: 1, // default to 1
            })
        }

        result.push({
            previousFilename: await extractRenameAction(githubResponseData[0]?.url, contentPath),
            // Get from parent
            commitSha: githubResponseData[0]?.parents[0]?.sha
        });
    }

    return {
        deepSearch: result,
        authors
    };
}

const findAuthor = (key: string, authors: IAuthorInfo[]) => {
    for (let i = 0; i < authors.length; i++)
        if (authors[i].username === key) {
            return i;
        }
    return -1;
}

export const fetchDeepContributors = async (contentPath: string, previousFilename: string, commitSha: string, authors: IAuthorInfo[], deepSearchLevel: number): Promise<IAuthorInfo[]> => {
    console.log(`Deep Search Level: ${deepSearchLevel++}`)
    if (!previousFilename) {
        console.log('No previousFilename')
        return [];
    }

    const blobHtmlUrl = `https://github.com/dotnetthailand/dotnetthailand.github.io/blob/${commitSha}/${previousFilename}`
    const blobHtml = await fetchHtmlRetry(blobHtmlUrl, limit);
    // blobHtml.indexOf("Cannot retrieve contributors at this time")
    console.log(`blobHtmlUrl: ${blobHtmlUrl}`)

    const $ = cheerio.load(blobHtml);
    await writeFileAsync('./html', $.html());

    const contributorsBoxQuery = $('#blob_contributors_box');
    const numberOfContributors = Number.parseInt(contributorsBoxQuery.find('.Link--primary').find('strong').text());

    const currentCommitApi = getCurrentCommitApi(commitSha);
    const commitData = (await fetchRetry(currentCommitApi, limit)).data;

    console.log(`numberOfContributors: ${numberOfContributors}`)

    if (numberOfContributors === 1) {
        const username = commitData?.author?.login || commitData?.commit?.author.email;
        const indexAuthor = findAuthor(username, authors);
        if (indexAuthor > 0) {
            authors[indexAuthor].commitsCount++;
        } else {
            authors.push({
                username,
                name: commitData?.commit?.author.name,
                profileUrl: commitData?.author?.html_url || commitData?.html_url,
                avatarUrl: commitData?.author?.avatar_url,
                commitsCount: 1, // default to 1
            })
        }
    } else {
        console.log(`numberOfContributors > 1`);
        const usernameTasks: Promise<any>[] = [];
        const result = contributorsBoxQuery.siblings().find('.avatar-user')
        for (let i = 0; i < result.length; i++) {
            const username = result[i].attribs.alt.replace(/(^\@)/g, '');
            usernameTasks.push(fetchRetry(`https://api.github.com/users/${username}`, limit))
        }
        if (result.length === 0) {
            console.error(contributorsBoxQuery.html())
        }
        console.log(`Debug ${contributorsBoxQuery.html()}`)
        const usernameList = await Promise.all(usernameTasks);
        usernameList.forEach((response: any) => {
            const username = response?.data.login;
            const indexAuthor = findAuthor(username, authors);
            if (indexAuthor > 0) {
                authors[indexAuthor].commitsCount++;
            } else {
                authors.push({
                    username: response?.data.login,
                    name: response?.data.name,
                    profileUrl: response?.data.html_url,
                    avatarUrl: response?.data.avatar_url,
                    commitsCount: 1, // default to 1
                })
            }
        });
    }

    const parentCommitSha = commitData?.parents[0]?.sha;
    const parentCommitApi = getCurrentCommitApi(parentCommitSha);
    const parentPreviousFileName = await extractRenameAction(parentCommitApi, contentPath);
    if (parentPreviousFileName) {
        fetchDeepContributors(contentPath, parentPreviousFileName, parentCommitSha, authors, deepSearchLevel);
    }
    return authors;
}

async function main() {
    console.log("Start")
    const contentPath = 'content/frontend-web/css-sass/fixing-a-floating-footer-at-the-bottom.mdx';
    // const contributors: Record<string, string> = {};
    // contributors.previousFilename = '/config/config.yml';
    // contributors.commitSha = '7f25cafa12f362e79942e67839af39ca9a9fa7cf';
    const initAuthors: IAuthorInfo[] = [];
    const { deepSearch, authors } = await fetchContributors(contentPath, initAuthors);
    const contributor = deepSearch.length > 0 ? deepSearch[0] : undefined;
    console.log(deepSearch)
    const usernameList = await fetchDeepContributors(contentPath, contributor?.previousFilename, contributor?.commitSha, authors, 1);
    console.log(usernameList)
}