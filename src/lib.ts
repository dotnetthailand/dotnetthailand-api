import axios from 'axios';
import cheerio from 'cheerio';
const repo = 'dotnetthailand/dotnetthailand.github.io';
const contentPath = 'content/frontend-web/css-sass/fixing-a-floating-footer-at-the-bottom.mdx';

let deepSearchLevel = 1;

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

const getCurrentCommitApi = (commitSha: string) => `https://api.github.com/repos/${repo}/commits/${commitSha}`; 

const extractRenameAction = async (url: string) => {
    console.log(`extractRenameAction: ${url}`)
    const commitOfTheFile = (await axios.get(url, axiosConfig)).data;
    const changedFile = commitOfTheFile.files.filter((file: any) => file.filename === `${contentPath}`)[0];
    // No rename file action, no need find more deep contributors.
    if (!changedFile?.previous_filename){
        console.warn("No previous_filename")
        return undefined;
    }

    return changedFile?.previous_filename;
}

const fetchContributors = async () => {
    // One File contains multiples commit.
    const contributorsGithubAPI = `https://api.github.com/repos/${repo}/commits?path=${contentPath}`;
    const githubResponseData = (await axios.get(contributorsGithubAPI, axiosConfig)).data;
    console.log(contributorsGithubAPI)
    if (!githubResponseData[0]?.url) return;

    return {
        previousFilename: await extractRenameAction(githubResponseData[0].url),
        // Get from parent
        commitSha: githubResponseData[0]?.parents[0]?.sha
    };
}

const findAuthor = (key: string, authors: IAuthorInfo[]) => {
    for(let i = 0;i < authors.length; i++)
        if( authors[i].username === key){
            return i;
        }
    return -1;
}

const fetchDeepContributors = async (previousFilename: string, commitSha: string, authors: IAuthorInfo[]): Promise<IAuthorInfo[]> => {
    console.log(`Deep Search Level: ${deepSearchLevel++}`)
    if (!previousFilename) {
        console.log('No previousFilename')
        return [];
    }
        
    const blobHtmlUrl = `https://github.com/dotnetthailand/dotnetthailand.github.io/blob/${commitSha}/${previousFilename}`
    const blobHtml = (await axios.get(blobHtmlUrl)).data;

    const $ = cheerio.load(blobHtml);
    const numberOfContributors = Number.parseInt($('#blob_contributors_box').find('.Link--primary').find('strong').text());

    const currentCommitApi = getCurrentCommitApi(commitSha);
    const commitData = (await axios.get(currentCommitApi, axiosConfig)).data;

    if (numberOfContributors === 1) {
        const username = commitData?.author?.login || commitData?.commit?.author.email;
        const indexAuthor= findAuthor(username, authors);
        if(indexAuthor > 0){
            authors[indexAuthor].commitsCount ++;
        }else {
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
        const result = $('#blob_contributors_box').siblings().find('.avatar-user')
        for (let i = 0; i < result.length; i++){
            const username = result[i].attribs.alt.replace(/(^\@)/g, '');
            usernameTasks.push(axios.get(`https://api.github.com/users/${username}`, axiosConfig))
        }
        if(result.length === 0){
            console.error($('#blob_contributors_box').html())
        }
        const usernameList = await Promise.all(usernameTasks);
        usernameList.forEach( (response: any) => {
            const username = response?.data.login;
            const indexAuthor= findAuthor(username, authors);
            if(indexAuthor > 0){
                authors[indexAuthor].commitsCount ++;
            }else {
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
    const parentPreviousFileName = await extractRenameAction(parentCommitApi);
    if(parentPreviousFileName){
        fetchDeepContributors(parentPreviousFileName, parentCommitSha, authors);
    }
    return authors;
}

async function main() {
    console.log("Start")
    // const contributors: Record<string, string> = {};
    // contributors.previousFilename = '/config/config.yml';
    // contributors.commitSha = '7f25cafa12f362e79942e67839af39ca9a9fa7cf';
    const initAuthors: IAuthorInfo[] = [];
    const contributors = await fetchContributors();
    console.log(contributors)
    const usernameList = await fetchDeepContributors(contributors?.previousFilename, contributors?.commitSha, initAuthors);
    console.log(usernameList)
}

main();