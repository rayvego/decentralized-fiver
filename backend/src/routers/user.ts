import {Router} from "express";
import {PrismaClient} from "@prisma/client";
import jwt from "jsonwebtoken";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import {authMiddleware} from "../middleware";
import {createTaskInput} from "../types";
import {TOTAL_DECIMALS} from "../config";

const router = Router()

const s3Client = new S3Client({
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ""
	},
	region: "us-east-1"
})

const DEFAULT_TITLE = "Select the most clickable thumbnail"

const prismaClient = new PrismaClient()

router.get("/task", authMiddleware, async (req, res) => {
	// @ts-ignore
	const taskId: string = req.query.taskId
	// @ts-ignore
	const userId: string = req.userId

	const taskDetails = await prismaClient.task.findFirst({
		where: {
			user_id: Number(userId),
			id: Number(taskId)
		},
		include: {
			options: true
		}
	})

	if (!taskDetails) {
		return res.status(411).json({
			message: "You dont have access to this task."
		})
	}

	const responses = await prismaClient.submission.findMany({
		where: {
			task_id: Number(taskId)
		},
		include: {
			option: true
		}
	})

	const result: Record<string, {
		count: number;
		option: {
			imageUrl: string
		}
	}> = {};

	taskDetails.options.forEach(option => {
		result[option.id] = {
			count: 0,
			option: {
				imageUrl: option.image_url
			}
		}
	})

	responses.forEach(r => {
		result[r.option_id].count++;
	});

	res.json({
		result,
		taskDetails
	})

})

router.post("/task", authMiddleware, async (req, res) => {
	// @ts-ignore
	const userId = req.userId

	// validate user inputs
	const body = req.body
	const parseData = createTaskInput.safeParse(body)

	if (!parseData.success) {
		return res.status(411).json({message: "You've sent the wrong inputs."})
	}

	// parse the signature to ensure the user has paid

	// transactions are atomic - if one fails, all fail
	let response = await prismaClient.$transaction(async tx => {
		const response = await tx.task.create({
			data: {
				title: parseData.data.title ?? DEFAULT_TITLE,
				amount: 1 * TOTAL_DECIMALS,
				signature: parseData.data.signature,
				user_id: userId
			}
		})

		await tx.option.createMany({
			data: parseData.data.options.map(x => ({
				image_url: x.imageUrl,
				task_id: response.id
			}))
		})

		return response
	})

	res.json({id: response.id})
})

router.get("/presignedUrl", authMiddleware, async (req, res) => {
	// @ts-ignore
	const userId = req.userId

	const { url, fields } = await createPresignedPost(s3Client, {
		Bucket: 'hkirat-cms',
		Key: `fiver/${userId}/${Math.random()}/image.jpg`,
		Conditions: [
			['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
		],
		Expires: 3600
	})

	res.json({
		preSignedUrl: url,
		fields
	})
})

// signin with wallet
// signing a message
router.post("/signin", async (req, res) => {
	// TODO: add sign verification logic here
	const hardcodedWalletAddress = "6RNuymnQvxxdXedt6VDA77qQEixZFceAgLtpsQLw23vX"

	const existingUser = await prismaClient.user.findFirst({
		where: {
			address: hardcodedWalletAddress
		}
	})

	if (existingUser) {
		const token = jwt.sign({
			userId: existingUser.id
		}, process.env.USER_JWT_SECRET!)

		res.json({token})
	} else {
		const user = await prismaClient.user.create({
			data: {
				address: hardcodedWalletAddress,
			}
		})

		const token = jwt.sign({
			userId: user.id
		}, process.env.USER_JWT_SECRET!)

		res.json({token})
	}
})


export default router