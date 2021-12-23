import { Pool } from "mysql2";

import uid from "uid-safe";
import bcrypt, { hash } from "bcrypt";
import { RowDataPacket } from "~mysql2/promise";

export default class PersistentStorage {

    readonly EXPIRE_TIME = 2 * 7 * 24 * 60 * 60;

    constructor(private con: Pool) {
        this.createTable()
        this.clearExpiredTokens();
    }

    private timer!: NodeJS.Timer;

    private async generateToken() {
        return await uid(30);
    }

    private createTable() {

        const sql = "CREATE TABLE IF NOT EXISTS `remember_tokens` (`Id` INT NOT NULL AUTO_INCREMENT, `Token` CHAR(60) NOT NULL, `UserId` INT NOT NULL, `Expires` INT NOT NULL, PRIMARY KEY (`Id`), FOREIGN KEY (`UserId`) REFERENCES users(`Id`));"

        this.con.query(sql, (err) => {
            if (err) {
                throw new Error("Error creating persistent cookie storage table: " + err)
            }
        });

    }

    clearExpiredTokens() {
        const clear = () => {
            const sql = "DELETE FROM remember_tokens WHERE Expires < ?;";

            this.con.query(sql, [Date.now() / 1000], (err) => {
                if (err) {
                    console.error(err);
                    clearInterval(this.timer);
                }
            })
        }

        clear();
        this.timer = setInterval(clear, 15 * 60 * 1000)
    }

    validateToken(token: string) {

        return new Promise((resolve, reject) => {
            bcrypt.hash(token, 10).then(hashed => {

                const sql = "SELECT UserId, Expires FROM remember_tokens WHERE Token = ?;"
                this.con.query(sql, [hashed], (err, res: RowDataPacket[]) => {
    
                    if (err) return reject(err);

                    if (res.length == 0) {
                        return resolve(null);
                    } 
                    
                    if (res[0].Expires < Date.now() / 1000) {
                        return resolve(null);
                    }

                    return resolve(res[0].UserId);
                })
    
            })
        });
    }

    async setToken(userId: BigInt) {
        const plainToken = await this.generateToken();
        
        const token = await bcrypt.hash(plainToken, 10);
        const expires = Date.now() / 1000 + this.EXPIRE_TIME;

        const sql = "INSERT INTO remember_tokens (Token, UserId, Expires) VALUES (?, ?, ?);";

        return await new Promise<any[]>((resolve, reject) => {
            this.con.query(sql, [token, userId, expires], (err, res) => {
                if (err) return reject(err);
                else resolve([plainToken, this.EXPIRE_TIME]);
            })
        })
    }

}