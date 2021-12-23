import session, { Session, Store } from "express-session";
import { Pool } from "mysql2";
import { RowDataPacket } from "~mysql2/promise";

export interface SessionOptions {
    tableName: string,

    sIdColumn: string,
    expiresColumn: string,
    dataColumn: string,

    expirationClearInterval: number
}

export default class SessionStorage extends Store {

    readonly DEFAULT_SESSION_OPTIONS: SessionOptions = {
        tableName: "sessions",
        sIdColumn: "SessionId",
        expiresColumn: "Expires",
        dataColumn: "Data",
        expirationClearInterval: 15 * 60 * 1000
    }

    private options: SessionOptions = this.DEFAULT_SESSION_OPTIONS;

    private interval: NodeJS.Timer | undefined;

    constructor(private con: Pool, options?: SessionOptions) {
        super()

        if (options) this.options = options;

        this.initialise()
    }

    private initialise() {
        this.con.query("CREATE TABLE IF NOT EXISTS ?? (?? varchar(128) NOT NULL UNIQUE, ?? int unsigned NOT NULL, ?? mediumtext COLLATE utf8mb4_bin, PRIMARY KEY (??));",
            [this.options.tableName, this.options.sIdColumn, this.options.expiresColumn, this.options.dataColumn, this.options.sIdColumn], (err) => {
                if (err) {
                    throw new Error("Error when creating Session Table " + this.options.tableName + ": " + err);
                }
            });

        this.expirationInterval();
    }

    expirationInterval() {

        const sql = "DELETE FROM ?? WHERE ?? < ?;"

        const clear = () => {
            this.con.query(sql, [this.options.tableName, this.options.expiresColumn, Date.now() / 1000], (err) => {
                if (err) {
                    console.error(err);
                    if (this.interval) clearInterval(this.interval);
                }
            })
        }

        clear()
        this.interval = setInterval(clear, this.options.expirationClearInterval);
    }

    get(sessionId: string, cb: any) {
        const sql = "SELECT ?? AS data, ?? AS expires FROM ?? WHERE ?? = ?;"

        this.con.query(sql, [this.options.dataColumn, this.options.expiresColumn, this.options.tableName, this.options.sIdColumn, sessionId], (err, res: RowDataPacket[]) => {
            if (err) {
                return cb(err, null);
            }

            const session: any = res[0];
            if (!session) {
                return cb(null, null);
            }

            if (session.expires < Date.now() / 1000) {
                return cb(null, null); // Session expired
            }

            return cb(null, JSON.parse(session.data));
        })
    }

    set(sessionId: string, session: any, cb: any) {
        let expires = undefined;

        if (session.cookie._expires) {
            expires = session.cookie._expires
        } else {
            expires = session.cookie.expires
        }

        if (!(session.cookie.expires instanceof Date)) {
            expires = new Date(expires);
        }
        
        expires = expires.getTime() / 1000;

        const sql = "INSERT INTO ?? (??, ??, ??) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ??=VALUES(??), ??=VALUES(??);"

        this.con.query(sql, [this.options.tableName, this.options.sIdColumn, this.options.expiresColumn, this.options.dataColumn, sessionId, expires, JSON.stringify(session), this.options.expiresColumn, this.options.expiresColumn, this.options.dataColumn, this.options.dataColumn], (err) => {
            if (err) cb(err);
            else cb();
        })
    }

    destroy(sessionId: string, cb: any) {
        const sql = "DELETE FROM ?? WHERE ?? = ?;"

        this.con.query(sql, [this.options.tableName, this.options.sIdColumn, sessionId], (err) => {
            if (err) return cb(err);
        });

        cb();
    }

}