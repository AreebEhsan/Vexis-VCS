import path from 'path';
import fs from 'fs/promises'
import crypto from 'crypto'
import {diffLines} from "diff";
import chalk from "chalk";
class Vexis{ //vexis.init
    constructor(repoPath ="."){
        this.repoPath = path.join(repoPath,".vexis")
        this.objectsPath = path.join(this.repoPath,'objects'); // .vexis/object
        this.headPath = path.join(this.repoPath,"HEAD"); // .vexis/HEAD
        this.indexPath = path.join(this.repoPath,'index'); // .vexis/index
        this.init()
    }   

    async init(){
        await fs.mkdir(this.objectsPath, {recursive: true});
        try{
            await fs.writeFile(this.headPath, '', {flag:"wx"}); // wx: open for writing. fails if file exists
            await fs.writeFile(this.indexPath, JSON.stringify([]), {flag: "wx"});        
        } catch (error) {
            console.log("Aleady initialized the .vexis folder")
        }

    }

    hashObject(content){
        return crypto.createHash('sha1').update(content).digest('hex')
    }
    async add(fileToBeAdded){
        // fileToBeAdded: path/to/file

        // read file content
        const fileData = await fs.readFile(fileToBeAdded, {encoding:'utf-8'});
        // calculate hash 
        const fileHash = this.hashObject(fileData);
        
        console.log(fileHash);
        const newFileHashedObjectPath = path.join(this.objectsPath, fileHash);
        
        await fs.writeFile(newFileHashedObjectPath, fileData);
        await this.updateStagingArea(fileToBeAdded, fileHash);
        console.log(`Added ${fileToBeAdded}`);

    }

    async updateStagingArea(filePath, fileHash){
        const index = JSON.parse(await fs.readFile(this.indexPath, {encoding:'utf-8'}));
        index.push({path:filePath, hash:fileHash}) //add the file to the index
        await fs.writeFile(this.indexPath, JSON.stringify(index)); // write the updated index file


    }
    async commit(message){
        const index = JSON.parse(await fs.readFile(this.indexPath, {encoding:'utf-8'}));
        const parentCommit = await this.getCurrentHead();
        const commitData = {
            timeStamp: new Date().toISOString(),
            message,
            files:index,
            parent:parentCommit
        };
        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath, commitHash);
        await fs.writeFile(commitPath, JSON.stringify(commitData));
        await fs.writeFile(this.headPath, commitHash); // update the head to point to the new commit
        await fs.writeFile(this.indexPath, JSON.stringify([])); // clear the index
        console.log(`Successfully created commit: ${commitHash}`);

    }
    async getCurrentHead(){
        try{
            return await fs.readFile(this.headPath, {encoding:'utf-8'});
        } catch(error){
            return null;

        }
    }

    async log(){
        let currentCommitHash = await this.getCurrentHead();
        while(currentCommitHash){
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash),{encoding:"utf-8"}));
            console.log(`-------------------------------\n`)
            console.log(`Commit: ${currentCommitHash}\nDate:${commitData.timeStamp}\n\n${commitData.message}\n\n`);
            currentCommitHash = commitData.parent;

        }
    }

    async showCommitDiff(commitHash){
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if (!commitData){
            console.log("Commit not found");
            return;
        }
        console.log("Change in the last commit are:");
        for(const file of commitData.files){
            console.log(`File: ${file.path}`);
            const fileContent = await this.getFileContent(file.hash);
            console.log(fileContent);
            if(commitData.parent){
                // getting the parent commit data
                const parentCommmitData = JSON.parse(await this.getCommitData(commitData.parent));
                const getParentFileContent = await this.getParentFileContent(parentCommmitData, file.path);
                if (getParentFileContent !== undefined){
                    console.log("\nDiff:");
                    const diff = diffLines(getParentFileContent, fileContent);
                    console.log(diff);
                    diff.forEach(part=> {
                        if(part.added){
                            process.stdout.write(chalk.green("++"+part.value));

                        }else if(part.removed){
                            process.stdout.write(chalk.red("--"+part.value));

                        }else {
                            process.stdout.write(chalk.grey(part.value));

                        }
                    });
                    console.log(); //new line
                } else{
                    console.log("New file in this commit")
                }
            } else{
                console.log("First commit");

            }
        }
    }
    async getParentFileContent(parentCommmitData, filePath){
        const parentFile = parentCommmitData.files.find(file=> file.path===filePath);
        if(parentFile){
            // get the file content from the parent commit and return the content
            return await this.getFileContent(parentFile.hash);
        }
    }

    async getCommitData(commithash){
        const commitPath = path.join(this.objectsPath, commithash);
        try{
            return await fs.readFile(commitPath, {encoding:'utf-8'});
        } catch(error){
            console.log('Failed to read the commit data', error);
            return null;
        }
    }
    async getFileContent(fileHash){
        const objectPath = path.join(this.objectsPath, fileHash);
        return fs.readFile(objectPath,{encoding:"utf-8"});

    }
}


const vexis = new Vexis();
(async()=>{
    // await vexis.init();
    // await vexis.add("sample.txt");
    // await vexis.add("sample2.txt");
    // await vexis.commit("2nd Commit");
    // await vexis.log();
    await vexis.showCommitDiff("20cc1c2f7798373efaecbb65fd42b8c8e15e4014");
    
})();


// vexis.add("sample.txt");

