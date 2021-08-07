import axios from 'axios';
import cheerio from 'cheerio';
const repo = 'dotnetthailand/dotnetthailand.github.io';
const contentPath = 'content/frontend-web/css-sass/fixing-a-floating-footer-at-the-bottom.mdx';
console.log("test")

const axiosConfig = {
    headers: {
        'Accept': 'application/vnd.github.v3+json'
    }
}

const fetchContributors = async () => {
    const contributorsGithubAPI = `https://api.github.com/repos/${repo}/commits?path=${contentPath}`;
    const githubResponseData = (await axios.get(contributorsGithubAPI, axiosConfig)).data;

    if (!githubResponseData[0]?.url) return;
    const commitOfTheFile = (await axios.get(githubResponseData[0].url, axiosConfig)).data;
    const changedFile = commitOfTheFile.files.filter((file: any) => file.filename === `${contentPath}`)[0];
    // No rename file action, no need find more deep contributors.
    if (!changedFile?.previous_filename){
        console.warn("No previous_filename")
        return;
    }

    return {
        previousFilename: changedFile?.previous_filename,
        parentCommitSha: githubResponseData[0]?.parents[0]?.sha
    };
}


const fetchDeepContributors = async () => {
    // const changedFile: Record<string, string> = {};
    // changedFile.previous_filename = '/config/config.yml';
    // const parentCommitSha = '7f25cafa12f362e79942e67839af39ca9a9fa7cf';

    const contributors = await fetchContributors();
    const blobHtmlUrl = `https://github.com/dotnetthailand/dotnetthailand.github.io/blob/${contributors?.parentCommitSha}/${contributors?.previousFilename}`
    const blobHtml = (await axios.get(blobHtmlUrl)).data;

    const $ = cheerio.load(blobHtml);
    const numberOfContributors = Number.parseInt($('#blob_contributors_box').find('.Link--primary').find('strong').text());
    const usernameList: string[] = [];
    if (numberOfContributors === 1) {
        const api = `https://api.github.com/repos/${repo}/commits/${contributors?.parentCommitSha}`;
        const commitData = (await axios.get(api, axiosConfig)).data;
        const username = commitData?.author?.login || commitData?.commit?.author.email;
        usernameList.push(username)
    } else {
        console.log(`numberOfContributors > 1`);
        const result = $('#blob_contributors_box').siblings().find('.avatar-user')
        for (let i = 0; i < result.length; i++){
            const username = result[i].attribs.alt.replace(/(^\@)/g, '');
            usernameList.push(username)
        }
    }
    return usernameList;
}

async function main() {
    const usernameList = await fetchDeepContributors();
    console.log(usernameList)
}

main();