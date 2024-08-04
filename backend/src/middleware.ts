import {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers["authorization"] ?? ""
	console.log(authHeader)

	try {
		const decoded = jwt.verify(authHeader, process.env.USER_JWT_SECRET!)

		// @ts-ignore
		if (decoded.userId) {
			// @ts-ignore
			req.userId = decoded.userId
			return next()
		} else {
			res.status(403).json({message: "You are not logged in."})
		}
	} catch (e) {
		res.status(403).json({message: "You are not logged in."})
	}
}

export function workerMiddleware(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers["authorization"] ?? ""
	console.log(authHeader)

	try {
		const decoded = jwt.verify(authHeader, process.env.WORKER_JWT_SECRET!)

		// @ts-ignore
		if (decoded.userId) {
			// @ts-ignore
			req.userId = decoded.userId
			return next()
		} else {
			res.status(403).json({message: "You are not logged in."})
		}
	} catch (e) {
		res.status(403).json({message: "You are not logged in."})
	}
}