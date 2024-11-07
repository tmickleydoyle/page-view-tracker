"use client";

import React, { useState, useEffect, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const TOTAL_EVENTS = 2500000;

// Web Worker code
const workerCode = `
importScripts('https://cdnjs.cloudflare.com/ajax/libs/Faker/3.1.0/faker.min.js');

let isRunning = false;
let eventCount = 0;
const TOTAL_EVENTS = ${TOTAL_EVENTS};
const BATCH_SIZE = 1000;
const channel = new BroadcastChannel('page-view-tracker');

let designCounts = { 'Design Static Layout': 0, 'Design Dynamic Layout': 0 };
let experienceCounts = { 'Design Static Layout': { positive: 0, negative: 0 }, 'Design Dynamic Layout': { positive: 0, negative: 0 } };

function generateEvent() {
  const design = Math.random() < 0.5 ? 'Design Static Layout' : 'Design Dynamic Layout';
  let experience;
  
  if (design === 'Design Static Layout') {
    experience = Math.random() < 0.5 ? 'positive' : 'negative';
  } else {
    experience = Math.random() < 0.6 ? 'positive' : 'negative';
  }
  
  designCounts[design]++;
  experienceCounts[design][experience]++;

  return {
    event_id: faker.random.uuid(),
    user_id: faker.random.uuid(),
    timestamp: faker.date.recent().toISOString(),
    page_url: 'https://tmickleydoyle.vercel.app',
    layout_design: design,
    user_experience: experience
  };
}

function generateBatch() {
  const batch = [];
  for (let i = 0; i < BATCH_SIZE && eventCount < TOTAL_EVENTS; i++) {
    batch.push(generateEvent());
    eventCount++;
  }
  return { batch };
}

function determineWinner() {
  const totalStatic = experienceCounts['Design Static Layout'].positive + experienceCounts['Design Static Layout'].negative;
  const totalDynamic = experienceCounts['Design Dynamic Layout'].positive + experienceCounts['Design Dynamic Layout'].negative;
  
  const positiveRateStatic = experienceCounts['Design Static Layout'].positive / totalStatic;
  const positiveRateDynamic = experienceCounts['Design Dynamic Layout'].positive / totalDynamic;
  
  if (positiveRateStatic > positiveRateDynamic + 0.05) {
    return 'Design Static Layout';
  } else if (positiveRateDynamic > positiveRateStatic + 0.05) {
    return 'Design Dynamic Layout';
  } else {
    return null;
  }
}

self.onmessage = function(e) {
  if (e.data === 'start') {
    isRunning = true;
    generateEvents();
  } else if (e.data === 'stop') {
    isRunning = false;
  } else if (e.data === 'reset') {
    eventCount = 0;
    designCounts = { 'Design Static Layout': 0, 'Design Dynamic Layout': 0 };
    experienceCounts = { 'Design Static Layout': { positive: 0, negative: 0 }, 'Design Dynamic Layout': { positive: 0, negative: 0 } };
    channel.postMessage({ type: 'reset' });
  }
};

function generateEvents() {
  if (!isRunning) return;

  try {
    const { batch } = generateBatch();
    const winner = determineWinner();
    channel.postMessage({ 
      type: 'update', 
      count: eventCount, 
      sample: batch[0],
      designCounts,
      experienceCounts,
      winner
    });

    if (eventCount < TOTAL_EVENTS) {
      setTimeout(generateEvents, 0);
    } else {
      channel.postMessage({ type: 'complete' });
    }
  } catch (error) {
    channel.postMessage({ type: 'error', message: error.message });
  }
}

channel.postMessage({ type: 'workerReady' });
`;

export function EnhancedPageViewGeneratorComponent() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [sampleEvent, setSampleEvent] = useState(null);
  const [designCounts, setDesignCounts] = useState({
    "Design Static Layout": 0,
    "Design Dynamic Layout": 0,
  });
  const [experienceCounts, setExperienceCounts] = useState({
    "Design Static Layout": { positive: 0, negative: 0 },
    "Design Dynamic Layout": { positive: 0, negative: 0 },
  });
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    channelRef.current = new BroadcastChannel("page-view-tracker");
    channelRef.current.onmessage = (event) => {
      if (event.data.type === "update") {
        setEventCount(event.data.count);
        setProgress((event.data.count / TOTAL_EVENTS) * 100);
        setSampleEvent(event.data.sample);
        setDesignCounts(event.data.designCounts);
        setExperienceCounts(event.data.experienceCounts);
        setWinner(event.data.winner);
      } else if (event.data.type === "complete") {
        setIsRunning(false);
      } else if (event.data.type === "reset") {
        setEventCount(0);
        setProgress(0);
        setSampleEvent(null);
        setDesignCounts({
          "Design Static Layout": 0,
          "Design Dynamic Layout": 0,
        });
        setExperienceCounts({
          "Design Static Layout": { positive: 0, negative: 0 },
          "Design Dynamic Layout": { positive: 0, negative: 0 },
        });
        setWinner(null);
      } else if (event.data.type === "error") {
        setError(event.data.message);
        setIsRunning(false);
      } else if (event.data.type === "workerReady") {
        setWorkerReady(true);
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
  }, []);

  const handleStart = () => {
    if (!workerReady) {
      setError("Worker is not ready. Please wait a moment and try again.");
      return;
    }
    setIsRunning(true);
    setError(null);
    workerRef.current?.postMessage("start");
  };

  const handleStop = () => {
    setIsRunning(false);
    workerRef.current?.postMessage("stop");
  };

  const handleReset = () => {
    setIsRunning(false);
    setError(null);
    workerRef.current?.postMessage("reset");
  };

  const calculatePercentage = (count: number, total: number): string => {
    return total > 0 ? ((count / total) * 100).toFixed(2) + "%" : "0%";
  };

  return (
    <div className="dark min-h-screen bg-gray-900 text-gray-100 p-4">
      <Card className="w-full max-w-3xl mx-auto bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-100">
            Page View Tracker for A/B Layouts
          </CardTitle>
          <CardDescription className="text-gray-400">
            Generate 2.5 million page view events with layout design attribution
            and user experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert
              variant="destructive"
              className="bg-red-900 border-red-600 text-red-100"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-between items-center text-gray-300">
            <span>Progress:</span>
            <span>
              {eventCount.toLocaleString()} / {TOTAL_EVENTS.toLocaleString()}{" "}
              events
            </span>
          </div>
          <Progress
            value={progress}
            className="w-full bg-gray-700 [&>div]:bg-blue-500"
          />
          <div className="flex space-x-2">
            <Button
              onClick={handleStart}
              disabled={isRunning || !workerReady}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {workerReady ? "Start" : "Initializing..."}
            </Button>
            <Button
              onClick={handleStop}
              disabled={!isRunning}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Stop
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Reset
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-gray-100">
                Design Static Layout:
              </h3>
              <ul className="text-gray-300">
                <li>Total: {designCounts["Design Static Layout"]}</li>
                <li>
                  Positive: {experienceCounts["Design Static Layout"].positive}{" "}
                  (
                  {calculatePercentage(
                    experienceCounts["Design Static Layout"].positive,
                    designCounts["Design Static Layout"]
                  )}
                  )
                </li>
                <li>
                  Negative: {experienceCounts["Design Static Layout"].negative}{" "}
                  (
                  {calculatePercentage(
                    experienceCounts["Design Static Layout"].negative,
                    designCounts["Design Static Layout"]
                  )}
                  )
                </li>
              </ul>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-gray-100">
                Design Dynamic Layout:
              </h3>
              <ul className="text-gray-300">
                <li>Total: {designCounts["Design Dynamic Layout"]}</li>
                <li>
                  Positive: {experienceCounts["Design Dynamic Layout"].positive}{" "}
                  (
                  {calculatePercentage(
                    experienceCounts["Design Dynamic Layout"].positive,
                    designCounts["Design Dynamic Layout"]
                  )}
                  )
                </li>
                <li>
                  Negative: {experienceCounts["Design Dynamic Layout"].negative}{" "}
                  (
                  {calculatePercentage(
                    experienceCounts["Design Dynamic Layout"].negative,
                    designCounts["Design Dynamic Layout"]
                  )}
                  )
                </li>
              </ul>
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-100">
              Winner:
            </h3>
            <p className="text-gray-300">
              {winner
                ? `${winner} is winning by more than 5%`
                : "No clear winner yet (less than 5% difference)"}
            </p>
          </div>
          {sampleEvent && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-gray-100">
                Sample Event:
              </h3>
              <pre className="bg-gray-800 p-2 rounded text-sm overflow-x-auto text-gray-300">
                {JSON.stringify(sampleEvent, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-gray-400">
            Events are generated in the background using a Web Worker. Design
            Static Layout has a 50/50 positive/negative split, while Design
            Dynamic Layout has a 60/40 split.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
