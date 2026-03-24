import {
    onAuthReady
} from "./authentication.js"
import { db } from "./firebaseConfig.js";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";


// Helper function to add the sample hike documents.
function addHikeData() {
    const hikesRef = collection(db, "hikes");
    console.log("Adding sample hike data...");
    addDoc(hikesRef, {
        code: "BBY01", name: "Burnaby Lake Park Trail", city: "Burnaby",
        level: "easy", details: "A lovely place for a lunch walk.", length: 10,
        hike_time: 60, lat: 49.2467097082573, lng: -122.9187029619698,
        last_updated: serverTimestamp()
    });
    addDoc(hikesRef, {
        code: "AM01", name: "Buntzen Lake Trail", city: "Anmore",
        level: "moderate", details: "Close to town, and relaxing.", length: 10.5,
        hike_time: 80, lat: 49.3399431028579, lng: -122.85908496766939,
        last_updated: serverTimestamp()
    });
    addDoc(hikesRef, {
        code: "NV01", name: "Mount Seymour Trail", city: "North Vancouver",
        level: "hard", details: "Amazing ski slope views.", length: 8.2,
        hike_time: 120, lat: 49.38847101455571, lng: -122.94092543551031,
        last_updated: serverTimestamp()
    });
}

async function seedHikes() {
    const hikesRef = collection(db, "hikes");
    const querySnapshot = await getDocs(hikesRef);

    // Check if the collection is empty
    if (querySnapshot.empty) {
        console.log("Hikes collection is empty. Seeding data...");
        addHikeData();
    } else {
        console.log("Hikes collection already contains data. Skipping seed.");
    }
}

// Call the seeding function when the main.html page loads.
seedHikes();

function showName() {

    // Get the DOM element where the user's name will be displayed
    // Example: <h1 id="name-goes-here"></h1>
    const nameElement = document.getElementById("name-goes-here");

    // Wait until Firebase Auth finishes checking the user's auth state
    onAuthReady(async (user) => {

        // If no user is logged in, redirect to the login page
        if (!user) {
            location.href = "index.html";
            return; // Stop execution
        }

        // Get the user's Firestore document from the "users" collection
        // Document ID is the user's unique UID
        const userDoc = await getDoc(doc(db, "users", user.uid));

        // Determine which name to display:
        const name = userDoc.exists()            // 1️⃣ Use Firestore name if document exists
            ? userDoc.data().name                // 2️⃣ Otherwise fallback to Firebase displayName
            : user.displayName || user.email;    // 3️⃣ Otherwise fallback to email

        // If the DOM element exists, update its text using a template literal to add "!"
        if (nameElement) {
            nameElement.textContent = `${name}!`;
        }

        //Read bookmarks as a plain array (no globals)
        const bookmarks = userDoc.data().bookmarks || [];

        //Display cards, but now pass user's ID and bookmarks (array)
        await displayCardsDynamically(user.uid, bookmarks);

    });
}

// Function to read the quote of the day from Firestore
function readQuote(day) {
    const quoteDocRef = doc(db, "quotes", day); // Get a reference to the document

    onSnapshot(quoteDocRef, (docSnap) => { // Listen for real-time updates
        if (docSnap.exists()) {
            document.getElementById("quote-goes-here").innerHTML = docSnap.data().quote;
        } else {
            console.log("No such document!");
        }
    }, (error) => {
        console.error("Error listening to document: ", error);
    });
}

//------------------------------------------------------------
// This function is called from showName() after we get the user's bookmarks from Firestore.
// Takes two input params: userID (string) and bookmarks (array of hike codes)
//------------------------------------------------------------
async function displayCardsDynamically(userID, bookmarks) {
    let cardTemplate = document.getElementById("hikeCardTemplate");
    const hikesCollectionRef = collection(db, "hikes");

    try {
        const querySnapshot = await getDocs(hikesCollectionRef);
        querySnapshot.forEach(doc => {
            // Clone the template
            let newcard = cardTemplate.content.cloneNode(true);
            const hike = doc.data(); // Get hike data once

            // Populate the card with hike data
            newcard.querySelector('.card-title').textContent = hike.name;
            newcard.querySelector('.card-text').textContent = hike.details || `Located in ${hike.city}.`;
            newcard.querySelector('.card-length').textContent = hike.length;

            newcard.querySelector('.card-image').src = `./images/${hike.code}.jpg`;

            // Add the link with the document ID
            newcard.querySelector(".read-more").href = `eachHike.html?docID=${doc.id}`;

            // New stuff
            const hikeDocID = doc.id;                                   //store the ID
            const icon = newcard.querySelector("i.material-icons");    //get a pointer to the bookmark icon DOM

            icon.id = "save-" + hikeDocID;
            const isBookmarked = bookmarks.includes(hikeDocID);
            icon.innerText = isBookmarked ? "bookmark" : "bookmark_border";
            icon.onclick = () => toggleBookmark(userID, hikeDocID);

            // End of new stuff

            // Attach the new card to the container
            document.getElementById("hikes-go-here").appendChild(newcard);
        });
    } catch (error) {
        console.error("Error getting documents: ", error);
    }
}

// Call the function to display cards when the page loads
//displayCardsDynamically();

readQuote("tuesday");

showName();


async function toggleBookmark(userId, hikeDocID) {
    const userRef = doc(db, "users", userId);     // get a pointer to the user's document
    const userSnap = await getDoc(userRef);       // read the user's document one time
    const userData = userSnap.data() || {};       // default to empty user data
    const bookmarks = userData.bookmarks || [];   // default to empty bookmarks array

    const iconId = "save-" + hikeDocID;           // construct icon's unique ID given the hike ID
    const icon = document.getElementById(iconId); // get a pointer to icon DOM

    // JS function ".includes" will return true if an item is found in the array
    const isBookmarked = bookmarks.includes(hikeDocID);

    // Because this block of code as two aynchronous calls that can be risky/fail
    // Here's an example of how to wrap it with a try/catch structure for error handling. 
    try {
        if (isBookmarked) {
            // Remove from Firestore array
            await updateDoc(userRef, { bookmarks: arrayRemove(hikeDocID) });
            // Update the bookmark icon DOM
            icon.innerText = "bookmark_border";

        } else {
            // Add to Firestore array
            await updateDoc(userRef, { bookmarks: arrayUnion(hikeDocID) });
            // Update the bookmark icon DOM 
            icon.innerText = "bookmark";
        }
    } catch (err) {
        console.error("Error toggling bookmark:", err);
    }
}
