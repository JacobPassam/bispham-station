import { Router } from "express";

export default interface StationRouter {
    path: string,
    router: Router,
    
    initRoutes(): any;
}