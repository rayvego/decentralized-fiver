import {Router} from "express";
import jwt from "jsonwebtoken";
import {PrismaClient} from "@prisma/client";
import {workerMiddleware} from "../middleware";
import {getNextTask} from "../db";
import {createSubmissionInput} from "../types";

const router = Router()

const TOTAL_SUBMISSIONS = 100

const prismaClient = new PrismaClient()

router.post("/payout", workerMiddleware, async (req, res) => {
	// @ts-ignore
	const userId = req.userId
	const worker = await prismaClient.worker.findFirst({
		where: {
			id: Number(userId)
		}
	})


	if (!worker) {
		return res.status(403).json({
			message: "User not found"
		})
	}

	// @ts-ignore
	console.log(worker.address);

	const txnId = "0x123123123"

	// we should add a lock here to avoid the user to pull out more money than they have.
	await prismaClient.$transaction(async tx => {
		await tx.worker.update({
			where: {
				id: Number(userId)
			},
			data: {
				pending_amount: {
					decrement: worker.pending_amount
				},
				locked_amount: {
					increment: worker.pending_amount
				}
			}
		})

		await tx.payouts.create({
			data: {
				user_id: Number(userId),
				amount: worker.pending_amount,
				status: "Processing",
				signature: txnId
			}
		})
	})

	res.json({
		message: "Processing payout",
		amount: worker.pending_amount
	})
})

router.get("/balance", workerMiddleware, async (req, res) => {
	// @ts-ignore
	const userId: string = req.userId

	const worker = await prismaClient.worker.findFirst({
		where: {
			id: Number(userId)
		}
	})

	res.json({
		pendingAmount: worker?.pending_amount,
		lockedAmount: worker?.locked_amount
	})
})

router.post("/submission", workerMiddleware, async (req, res) => {
	// @ts-ignore
	const userId = req.userId;
	const body = req.body;
	const parsedBody = createSubmissionInput.safeParse(body);

	if (parsedBody.success) {
		const task = await getNextTask(Number(userId));
		if (!task || task?.id !== Number(parsedBody.data.taskId)) {
			return res.status(411).json({
				message: "Incorrect task id"
			})
		}

		const amount = (Number(task.amount) / TOTAL_SUBMISSIONS).toString();

		const submission = await prismaClient.$transaction(async tx => {
			const submission = await tx.submission.create({
				data: {
					option_id: Number(parsedBody.data.selection),
					worker_id: userId,
					task_id: Number(parsedBody.data.taskId),
					amount: Number(amount)
				}
			})

			await tx.worker.update({
				where: {
					id: userId,
				},
				data: {
					pending_amount: {
						increment: Number(amount)
					}
				}
			})

			return submission;
		})

		const nextTask = await getNextTask(Number(userId));
		res.json({
			nextTask,
			amount
		})


	} else {
		res.status(411).json({
			message: "Incorrect inputs"
		})

	}

})

router.get("/nextTask", workerMiddleware, async (req, res) => {
	// @ts-ignore
	const userId: string = req.userId

	const task = await getNextTask(Number(userId))

	if (!task) {
		return res.status(411).json({
			message: "No tasks available."
		})
	} else {
		return res.json({task})
	}
})

router.post("/signin", async (req, res) => {
	// TODO: add sign verification logic here
	const hardcodedWalletAddress = "6RNuymnQvxxdXedt6VDA77qQEixZFceAgLtpsQLw23va"

	const existingUser = await prismaClient.worker.findFirst({
		where: {
			address: hardcodedWalletAddress
		}
	})

	if (existingUser) {
		const token = jwt.sign({
			userId: existingUser.id
		}, process.env.WORKER_JWT_SECRET!)

		res.json({token})
	} else {
		const user = await prismaClient.worker.create({
			data: {
				address: hardcodedWalletAddress,
				pending_amount: 0,
				locked_amount: 0
			}
		})

		const token = jwt.sign({
			userId: user.id
		}, process.env.WORKER_JWT_SECRET!)

		res.json({token})
	}
})

export default router