import { Request, Response, Router } from "express";
import { Session } from "express-session";
import PersistentStorage from "./lib/persistentStorage";
import { UserController, User } from "./user";

interface UserSession extends Session {
    userId?: BigInt
}

export default class UserRoutes {

    path: string = '/auth'
    router: Router = Router();

    constructor(private userController: UserController, private persistentStorage: PersistentStorage) {
    }

    initRoutes() {
        this.router.post('/new', this.newAccount)
        this.router.get('/hello', this.hello)

        this.router.post('/login', this.login)
        this.router.delete('/logout', this.logout)
    }

    newAccount = (req: Request, res: Response) => {
        const body = req.body;

        if (!body.username || !body.email || !body.password) {
            res.status(400).json({ "error": "Fill in required fields." })
        } else if (body.password.length > 72) {
            res.status(400).json({ "error": "Passwords cannot be greater than 72 characters in length." });
        } else {

            this.userController.registerUser(body.username, body.email, body.password).catch(err => {
                res.status(err[0]).json({ "error": err[1] });
            }).then((userObject: any) => {
                const user: any = userObject;

                const session: any = req.session;
                session.userId = user.id;

                if (body.rememberMe) {
                    this.persistentStorage.setToken(user.id).then((tk: any[]) => {
                        res.cookie("x-remember-me", tk[0], {
                            maxAge: tk[1]
                        });

                        res.json(user);
                    }).catch(err => res.json({ "error": err }));
                } else {
                    res.json(user);
                }

            }).catch(err => res.json({ "error": err }));
        }
    }

    login = (req: Request, res: Response) => {
        const body = req.body;

        const session: UserSession = req.session;
        if (session.userId) {
            return this.userController.getUserById(session.userId)
                .then(u => { res.status(200).json(u); })
                .catch(err => res.status(err[0]).json({ "error": err[1] }));
        }

        const rememberMe = req.cookies["x-remember"];
        if (rememberMe) {
            this.persistentStorage.validateToken(rememberMe).then(id => {
                if (id == null) {
                    // bad bad bad 
                } else {
                    // wooooo do the sign in job
                }
            })
        }

        if (!body.username || !body.password) {
            return res.status(400).json({ "error": "Username or password not provided." });
        }

        this.userController.validateLogin(body.username, body.password)
            .then((id: BigInt | null) => {
                if (!id) {
                    return res.status(401).json({ "error": "Username or password incorrect." });
                }

                this.userController.getUserById(id)
                    .then((u: User) => {
                        const session: UserSession = req.session;
                        session.userId = u.id;

                        if (body.rememberMe && u.id) {
                            this.persistentStorage.setToken(u.id).then((tk: any[]) => {
                                res.cookie("x-remember-me", tk[0], {
                                    maxAge: tk[1]
                                });
        
                                res.status(200).json(u);
                            }).catch(err => res.json({ "error": err }));
                        } else {
                            res.status(200).json(u);
                        }
                    })
                    .catch(err => res.status(err[0]).json({ "error": err[1] }));
            }).catch(err => res.status(err[0]).json({"error": err}));
    }

    hello = (req: Request, res: Response) => {
        const session: any = req.session;

        if (!session.userId) { res.sendStatus(401); }
        else { res.sendStatus(200); }
    }

    logout = (req: Request, res: Response) => {
        const session: any = req.session;

        if (!session.userId) { res.sendStatus(401); }
        else {
            req.session.destroy(() => {
                res.sendStatus(200);
            })
        }
    }

}