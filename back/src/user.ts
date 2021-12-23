import bcrypt from 'bcrypt';
import { RowDataPacket } from '~mysql2/promise';
import { DBController } from './db';

export interface User {

    id?: BigInt,

    username: string,
    email: string,
    created: Date,

    profilePictureUrl?: string,
    bio: string,

}

export enum UserCreationError {
    DUPLICATE_USERNAME,
    DUPLICATE_EMAIL
}

export class UserController {

    constructor(private db: DBController) {
        if (!db.ConnectionPool) throw new Error("CONNECTION NOT SETUP PRIOR TO INITIALISING USERCONTROLLER")
    }

    async registerUser(username: string, email: string, pwd: string) {

        const d = new Date()
        const u: User = {username: username, email: email, created: d, bio: "This user hasn't set a bio."}

        pwd = await bcrypt.hash(pwd, 10);

        return new Promise((resolve, reject) => {

            this.db.ConnectionPool?.execute("INSERT INTO users (Username, Email, Created, Password, Bio) VALUES (?, ?, ?, ?, ?)", [u.username, u.email, u.created.getTime(), pwd, u.bio], (err, res: any) => {
                if (err) { 

                    if (err.sqlState == "23000") {
                        if (err.message.includes('users.Username')) {
                            return reject([409, "Username is already registered."]);
                        } else if (err.message.includes('users.Email')) {
                            return reject([409, "Email is already registered."]);
                        }
                    }

                    reject([500, err.name]);

                } else {
                    u.id = res.insertId;

                    resolve(u);
                }
            })

        });
    }   

    async getUserById(id: BigInt) {
        return new Promise<User>((resolve, reject) => {

            this.db.ConnectionPool?.query("SELECT Username, Email, Created, Bio FROM users WHERE Id = ?;", [id], (err, res: RowDataPacket[]) => {
                if (err) return reject ([500, err]);
                
                if (res.length == 0) {
                    return reject([404, "User not found."]);
                }

                const user = res[0];

                const u: User = {id, username: user.Username, email: user.Email, created: user.Created, bio: user.Bio}
                return resolve(u);
            });

        });
    }

    async validateLogin(username: string, password: string) {
        return new Promise<BigInt | null>((resolve, reject) => {

            this.db.ConnectionPool?.query("SELECT Id, Password FROM users WHERE Username = ?;", [username], (err, res: RowDataPacket[]) => {
                if (err) return reject([500, err]);

                if (res.length == 0) {
                    return resolve(null);
                }

                const pwd = res[0].Password
                if (bcrypt.compareSync(password, pwd)) {
                    const id: BigInt = res[0].Id;

                    return resolve(id);
                } else {
                    return resolve(null);
                }
            
            })

        });
    }

}