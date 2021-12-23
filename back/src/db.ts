import fs from "fs";
import { Pool }  from "mysql2";
import mysql from "mysql2";

function readCredsFromFile(filePath: string): string[] {
    return fs.readFileSync(filePath, 'utf-8').split(",");
}

class DBController {

    private host: string;
    private user: string;
    private password: string;
    private database: string;

    ConnectionPool!: Pool;

    constructor(creds: string[]) {
        this.host = creds[0];
        this.user = creds[1];
        this.password = creds[2];
        this.database = creds[3];
    }

    connect() {
        this.ConnectionPool = mysql.createPool({
            host: this.host,
            user: this.user,
            password: this.password,
            database: this.database
        });
        
        this.ConnectionPool.query("/* ping */ SELECT 1;", (err) => {
            if (!err) {
                console.log("MySQL Connection Alive!")
                this.setup()
            } else {
                throw new Error(err.message);
            }
        })
    }

    private setup() {

        console.log("Commencing setup... just in case.")

        this.ConnectionPool?.query(
            "CREATE TABLE IF NOT EXISTS users (`Id` INT NOT NULL AUTO_INCREMENT, `Username` VARCHAR(32) UNIQUE, `Email` VARCHAR(320) UNIQUE, `Created` BIGINT, `Password` CHAR(60), `ProfilePictureUrl` TEXT, `Bio` TEXT, PRIMARY KEY (Id));", (err) => {
                if (err) { throw new Error(err.message) }
                else { console.log("Done, I think.")}
            })

    }

}

export { DBController, readCredsFromFile }