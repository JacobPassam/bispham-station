import express from "express";
import sessions from "express-session";

import fs from "fs";

import { DBController, readCredsFromFile } from "./db";
import StationRouter from "./stationRouter";
import { UserController } from "./user";
import UserRoutes from "./userRoutes";

import SessionStorage from './lib/sessionStorage';
import PersistentStorage from "./lib/persistentStorage";

import cookieParser from "cookie-parser";

const PORT = 3000;

const app = express();
app.use(cookieParser());

const db = new DBController(readCredsFromFile("../DB_CREDS"));
db.connect();

const user = new UserController(db);

app.use(sessions({
    secret: fs.readFileSync("../SESSION_SECRET", 'utf-8'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    },
    store: new SessionStorage(db.ConnectionPool)
}));

const remember = new PersistentStorage(db.ConnectionPool);

app.use(express.json());

const routes: StationRouter[] = [ new UserRoutes(user, remember) ]

routes.forEach(route => {
    route.initRoutes();
    app.use(route.path, route.router);
})

app.listen(PORT, () => {
    console.log("Listening on Port " + PORT)
});

app.listen()