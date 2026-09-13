document.addEventListener('DOMContentLoaded', async () => {
    // -------------------------------------------------------------
    // 1. DOM Elements
    // -------------------------------------------------------------
    const videoElement = document.getElementsByClassName('input_video')[0];
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const canvasCtx = canvasElement.getContext('2d');
    
    const accuracyFill = document.getElementById('accuracy-fill');
    const accuracyText = document.getElementById('accuracy-text');
    const holdText = document.getElementById('hold-text');
    const gestureOutput = document.getElementById('gesture-output');
    
    const challengeWordEl = document.getElementById('challenge-word');
    const challengeHintEl = document.getElementById('challenge-hint');
    const lessonProgressEl = document.getElementById('lesson-progress');
    const lessonTextEl = document.getElementById('lesson-text');
    const successOverlay = document.getElementById('success-overlay');
    const lessonCompleteModal = document.getElementById('lesson-complete-modal');
    
    const gestureHints = {
        "HELLO": "Hold your hand up, palm facing forward. Keep all 5 fingers completely straight and pointing upwards.",
        "PEACE": "Make a 'V' shape. Keep your Index and Middle fingers straight up. Curl your Thumb, Ring, and Pinky into your palm.",
        "I LOVE YOU": "Extend your Thumb, Index, and Pinky fingers straight out. Keep your Middle and Ring fingers curled down.",
        "YES": "Make a standard, tight fist. Curl all four fingers down and wrap your Thumb across them.",
        "NO": "Point your Thumb, Index, and Middle fingers straight forward. Keep your Ring and Pinky fingers tightly curled.",
        "GOOD / THUMBS UP": "Make a fist, but extend your Thumb perfectly straight upwards. Keep all other fingers curled.",
        "THUMBS DOWN": "Make a fist, but point your Thumb perfectly straight downwards. Keep all other fingers curled.",
        "WATER": "Make a 'W' shape. Extend your Index, Middle, and Ring fingers straight up. Curl your Thumb and Pinky down."
    };

    // -------------------------------------------------------------
    // 2. Gesture Definitions (Fingerpose)
    // -------------------------------------------------------------
    const signHello = new fp.GestureDescription('HELLO');
    for(let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signHello.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signHello.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
        signHello.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.9);
        signHello.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.9);
    }

    const signPeace = new fp.GestureDescription('PEACE');
    signPeace.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
    signPeace.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
    signPeace.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.9);
    signPeace.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.9);
    signPeace.addCurl(fp.Finger.Middle, fp.FingerCurl.NoCurl, 1.0);
    signPeace.addDirection(fp.Finger.Middle, fp.FingerDirection.VerticalUp, 1.0);
    signPeace.addDirection(fp.Finger.Middle, fp.FingerDirection.DiagonalUpLeft, 0.9);
    signPeace.addDirection(fp.Finger.Middle, fp.FingerDirection.DiagonalUpRight, 0.9);
    for(let finger of [fp.Finger.Thumb, fp.Finger.Ring, fp.Finger.Pinky]) {
        signPeace.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signPeace.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    const signILoveYou = new fp.GestureDescription('I LOVE YOU');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Pinky]) {
        signILoveYou.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    for (let finger of [fp.Finger.Middle, fp.Finger.Ring]) {
        signILoveYou.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signILoveYou.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    const signYes = new fp.GestureDescription('YES');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signYes.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signYes.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    const signNo = new fp.GestureDescription('NO');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle]) {
        signNo.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    for (let finger of [fp.Finger.Ring, fp.Finger.Pinky]) {
        signNo.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signNo.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // --- NEW: THUMBS UP (GOOD) ---
    const signThumbsUp = new fp.GestureDescription('GOOD / THUMBS UP');
    signThumbsUp.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    signThumbsUp.addDirection(fp.Finger.Thumb, fp.FingerDirection.VerticalUp, 1.0);
    signThumbsUp.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpRight, 0.9);
    signThumbsUp.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpLeft, 0.9);
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signThumbsUp.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signThumbsUp.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // --- NEW: THUMBS DOWN (BAD) ---
    const signThumbsDown = new fp.GestureDescription('BAD / THUMBS DOWN');
    signThumbsDown.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    signThumbsDown.addDirection(fp.Finger.Thumb, fp.FingerDirection.VerticalDown, 1.0);
    signThumbsDown.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalDownRight, 0.9);
    signThumbsDown.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalDownLeft, 0.9);
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signThumbsDown.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signThumbsDown.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // --- NEW: STOP ---
    const signStop = new fp.GestureDescription('STOP');
    for(let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signStop.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signStop.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
    }

    // --- NEW: WATER ('W' Handshape) ---
    const signWater = new fp.GestureDescription('WATER');
    // Index, Middle, Ring are straight up
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
        signWater.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signWater.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
    }
    // Thumb and Pinky are curled
    signWater.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl, 1.0);
    signWater.addCurl(fp.Finger.Pinky, fp.FingerCurl.HalfCurl, 0.9);
    signWater.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
    signWater.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.9);

    const estimator = new fp.GestureEstimator([
        signHello, signPeace, signILoveYou, signYes, signNo, 
        signThumbsUp, signThumbsDown, signWater
    ]);

    // -------------------------------------------------------------
    // 3. Lesson Logic & Smart Analytics
    // -------------------------------------------------------------
    const lessonPlan = ["HELLO", "GOOD / THUMBS UP", "WATER", "I LOVE YOU", "PEACE"];
    const totalUniqueWords = lessonPlan.length;
    let currentLessonIndex = 0;
    
    // Analytics State
    let isTransitioning = false; 
    let detectionStartTime = 0;
    let challengeStartTime = 0; // When the user was first shown the word
    let totalTimeMs = 0;
    let struggleWordsCount = 0;
    const struggleThresholdMs = 8000; // 8 seconds
    const HOLD_TIME_REQUIRED = 1500; // 1.5 seconds hold for learning mode
    
    const toastNotification = document.getElementById('toast-notification');
    
    function showToast() {
        toastNotification.classList.add('active');
        setTimeout(() => toastNotification.classList.remove('active'), 3000);
    }

    function updateGameState() {
        if (lessonPlan.length === 0) {
            challengeWordEl.innerText = "NO SIGNS TRAINED";
            lessonTextEl.innerText = "Go back to Live Translation to teach the AI words!";
            return;
        }

        if (currentLessonIndex >= lessonPlan.length) {
            // Lesson Complete - Compute Analytics
            const statTotalTime = document.getElementById('stat-total-time');
            const statAvgTime = document.getElementById('stat-avg-time');
            const statStruggles = document.getElementById('stat-struggles');
            const statMastered = document.getElementById('stat-mastered');

            const totalSecs = (totalTimeMs / 1000).toFixed(1);
            const avgSecs = (totalTimeMs / lessonPlan.length / 1000).toFixed(1);
            
            statTotalTime.innerText = `${totalSecs}s`;
            statAvgTime.innerText = `${avgSecs}s`;
            statStruggles.innerText = struggleWordsCount;
            statMastered.innerText = totalUniqueWords - struggleWordsCount;

            lessonCompleteModal.classList.add('active');
            return;
        }
        
        const currentWord = lessonPlan[currentLessonIndex];
        challengeWordEl.innerText = currentWord;
        challengeHintEl.innerText = gestureHints[currentWord] || "Sign the word above!";
        const progressPct = (currentLessonIndex / lessonPlan.length) * 100;
        lessonProgressEl.style.width = `${progressPct}%`;
        lessonTextEl.innerText = `${currentLessonIndex} / ${lessonPlan.length}`;
        
        resetDetectionUI();
        challengeStartTime = Date.now(); // Start stopwatch for this word
    }
    
    function triggerSuccess() {
        isTransitioning = true;
        
        // Calculate Time to Completion
        const timeToCompletion = Date.now() - challengeStartTime;
        totalTimeMs += timeToCompletion;
        
        // Adaptive Logic: Did they struggle?
        if (timeToCompletion > struggleThresholdMs) {
            struggleWordsCount++;
            // Push it to the end of the lesson queue!
            lessonPlan.push(lessonPlan[currentLessonIndex]);
            showToast();
        }

        // Show overlay
        successOverlay.classList.add('active');
        
        // Play success sound
        const utterance = new SpeechSynthesisUtterance("Great job!");
        utterance.rate = 1.2;
        window.speechSynthesis.speak(utterance);
        
        // Wait 2 seconds, then go to next word
        setTimeout(() => {
            successOverlay.classList.remove('active');
            currentLessonIndex++;
            isTransitioning = false;
            updateGameState();
        }, 2000);
    }

    function resetDetectionUI() {
        detectionStartTime = 0;
        accuracyText.innerText = "0%";
        accuracyFill.style.width = "0%";
        accuracyFill.style.background = "var(--primary)";
        holdText.innerText = "Show the sign to start...";
    }

    // Initialize Game State
    updateGameState();

    // -------------------------------------------------------------
    // 4. MediaPipe Camera Loop
    // -------------------------------------------------------------
    async function onResults(results) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Draw video frame
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            
        if (isTransitioning || currentLessonIndex >= lessonPlan.length) {
            canvasCtx.restore();
            return;
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            gestureOutput.innerText = "";
            const landmarks = results.multiHandLandmarks[0];
            
            // Draw skeleton
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(99, 102, 241, 0.85)', lineWidth: 4});
            drawLandmarks(canvasCtx, landmarks, {color: '#67e8f9', lineWidth: 2, radius: 4});
            
            const fpLandmarks = landmarks.map(lm => [
                lm.x * canvasElement.width, 
                lm.y * canvasElement.height, 
                lm.z * canvasElement.width 
            ]);
            
            const estimated = estimator.estimate(fpLandmarks, 8.0);
            const targetWord = lessonPlan[currentLessonIndex];
            
            // Check if ANY estimated gesture matches our target word
            const match = estimated.gestures.find(g => g.name === targetWord);
            
            if (match) {
                const confidencePct = Math.min(Math.round(match.score * 10), 100);
                
                // Timer Logic
                if (detectionStartTime === 0) {
                    detectionStartTime = Date.now();
                }
                
                const now = Date.now();
                const heldFor = now - detectionStartTime;
                const progress = Math.min((heldFor / HOLD_TIME_REQUIRED) * 100, 100);
                
                accuracyText.innerText = `${confidencePct}%`;
                accuracyFill.style.width = `${confidencePct}%`;
                accuracyFill.style.background = confidencePct > 85 ? 'var(--success)' : 'var(--primary)';
                holdText.innerText = "Hold steady!";
                
                if (progress >= 100) {
                    triggerSuccess();
                }
            } else {
                // If they lose the sign, reset progress rapidly (or instantly)
                resetDetectionUI();
                holdText.innerText = "Sign does not match. Try again!";
            }
        } else {
            resetDetectionUI();
            gestureOutput.innerText = "Waiting for Hand...";
        }
        canvasCtx.restore();
    }

    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});
    
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });
    
    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 640,
        height: 480
    });
    camera.start();
});
