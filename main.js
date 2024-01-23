import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import 'firebase/firestore';
import './style.css';


const firebaseConfig = {
  apiKey: "AIzaSyD9cb4Cc2XG44zaBUQSCZkgTX_nnDR3mnM",
  authDomain: "vidchat-17fb2.firebaseapp.com",
  projectId: "vidchat-17fb2",
  storageBucket: "vidchat-17fb2.appspot.com",
  messagingSenderId: "124551597117",
  appId: "1:124551597117:web:2083ab4d5f1106c097ee54",
  measurementId: "G-4XFB51NXC5"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();


// Global state
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');


// Media sources set up 
webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true})
  remoteStream = new MediaStream();

  // take two streams and make them available on the peer connection, and show them on the DOM
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // listen to a/v from peer connection (remote stream) and add to video stream
  pc.ontrack = event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  }

  //apply to vid elements in the dom
  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;

};


// creates an offer
callButton.onclick = async () => {
  // firestore collection reference
  const callDoc = firestore.collection('calls').doc(); // manages answer and offers from both users
  const offerCanditates = callDoc.collection('offerCandidates');
  const answerCanditates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id; // used by other user to answer the call

  // get canditates for caller, save to db
  pc.onicecandidate = event => {
    event.canditate && offerCanditates.add(event.canditate.toJSON());
  }

  // create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer){
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // when answered, add canditate to peer connection
  answerCanditates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added'){
        const canditate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(canditate);
      }
    });
  });

  hangupButton.disabled = false
}


// Answer the call inputting the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCanditates = callDoc.collection('answerCanditates');

  pc.onicecanditate = event => {
    event.canditate && answerCanditates.add(event.canditate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
  };

  await callDoc.update({ answer });

  offerCanditates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      };
    });
  });
};


