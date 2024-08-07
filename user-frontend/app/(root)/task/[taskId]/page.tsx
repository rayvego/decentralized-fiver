"use client"
import Appbar from '@/components/Appbar';
import axios from 'axios';
import { useEffect, useState } from 'react';
import {BACKEND_URL} from "@/utils";

async function getTaskDetails(taskId: string) {
	const response = await axios.get(`${BACKEND_URL}/v1/user/task?taskId=${taskId}`, {
		headers: {
			"Authorization": localStorage.getItem("token")
		}
	})
	return response.data
}

export default function Page({params: {
	taskId
}}: {params: { taskId: string }}) {
	const [result, setResult] = useState<Record<string, {
		count: number;
		option: {
			imageUrl: string
		}
	}>>({});
	const [taskDetails, setTaskDetails] = useState<{
		title?: string
	}>({});

	// * ideally should use this which re-fetches the data every 5 seconds
	// useEffect(() => {
	// 	let pollTimeout; // Variable to store the timeout ID
	//
	// 	const fetchData = () => {
	// 		getTaskDetails(taskId)
	// 			.then((data) => {
	// 				setResult(data.result);
	// 				setTaskDetails(data.taskDetails);
	//
	// 				// Start the polling timer
	// 				pollTimeout = setTimeout(fetchData, 5000); // Poll every 5 seconds
	// 			})
	// 			.catch(error => {
	// 				// Handle errors here
	// 				console.error('Error fetching task details:', error);
	// 			});
	// 	};
	//
	// 	// Initial fetch
	// 	fetchData();
	//
	// 	return () => {
	// 		// Cleanup: Clear the timeout if the component unmounts
	// 		clearTimeout(pollTimeout);
	// 	};
	// }, [taskId]);

	useEffect(() => {
		getTaskDetails(taskId)
			.then((data) => {
				setResult(data.result)
				setTaskDetails(data.taskDetails)
			})
	}, [taskId]);

	return <div>
		<Appbar />
		<div className='text-2xl pt-20 flex justify-center'>
			{taskDetails.title}
		</div>
		<div className='flex justify-center pt-8'>
			{Object.keys(result || {}).map(taskId => <Task imageUrl={result[taskId].option.imageUrl} votes={result[taskId].count} />)}
		</div>
	</div>
}

function Task({imageUrl, votes}: {
	imageUrl: string;
	votes: number;
}) {
	return <div>
		<img className={"p-2 w-96 rounded-md"} src={imageUrl} />
		<div className='flex justify-center'>
			{votes}
		</div>
	</div>
}