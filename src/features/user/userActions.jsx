import moment from "moment";
import cuid from "cuid";
import { toastr } from "react-redux-toastr";
import {
  asyncActionError,
  asyncActionFinish,
  asyncActionStart
} from "../async/asyncActions";

//getFirebase is an exception for updating Firestore profile
export const updateProfile = user => async (
  dispatch,
  getState,
  { getFirebase }
) => {
  const firebase = getFirebase();
  //Update dateOfBirth only if the dateOfBirth is != dateOfBirth stored in firebase
  if (user.dateOfBirth !== getState().firebase.profile.dateOfBirth) {
    user.dateOfBirth = moment(user.dateOfBirth).toDate();
  }
  try {
    //updateProfile used against firestore user profile document
    await firebase.updateProfile(user);
    toastr.success("Success", "Profile updated");
  } catch (error) {
    console.log(error);
  }
};

export const uploadProfileImage = (file, fileName) => async (
  dispatch,
  getState,
  { getFirebase, getFirestore }
) => {
  const imageName = cuid();
  const firebase = getFirebase();
  const firestore = getFirestore();
  const user = firebase.auth().currentUser;
  const path = `${user.uid}/user_images`;
  const options = {
    name: imageName
  };
  try {
    dispatch(asyncActionStart());
    // upload file to firebase storage
    let uploadedFile = await firebase.uploadFile(path, file, null, options);
    // get url of image
    let downloadURL = await uploadedFile.uploadTaskSnapshot.downloadURL;
    // get userdoc from Firestore
    let userDoc = await firestore.get(`users/${user.uid}`);
    // check if user has photo, if not, update profile with new photo
    if (!userDoc.data().photoURL) {
      //update profile in Firestore user document
      await firebase.updateProfile({
        photoURL: downloadURL
      });
      //update profile in Firebase authentication
      await user.updateProfile({
        photoURL: downloadURL
      });
    }
    // add new photo as new image in photos collection
    await firestore.add(
      {
        collection: "users",
        doc: user.uid,
        subcollections: [{ collection: "photos" }]
      },
      {
        name: imageName,
        url: downloadURL
      }
    );
    dispatch(asyncActionFinish());
  } catch (error) {
    console.log(error);
    dispatch(asyncActionError());
    throw new Error("Problem uploading photo");
  }
};

export const deletePhoto = photo => async (
  dispatch,
  getState,
  { getFirebase, getFirestore }
) => {
  const firebase = getFirebase();
  const firestore = getFirestore();
  const user = firebase.auth().currentUser;
  try {
    await firebase.deleteFile(`${user.uid}/user_images/${photo.name}`);
    await firestore.delete({
      collection: "users",
      doc: user.uid,
      subcollections: [{ collection: "photos", doc: photo.id }]
    });
  } catch (error) {
    console.log(error);
    throw new Error("Problem deleting the photo");
  }
};

export const setMainPhoto = photo => async (
  dispatch,
  getState,
  { getFirebase }
) => {
  const firebase = getFirebase();
  try {
    return await firebase.updateProfile({
      photoURL: photo.url
    });
  } catch (error) {
    console.log(error);
    throw new Error("Problem setting main photo");
  }
};

export const goingToEvent = event => async (
  dispatch,
  getState,
  { getFirestore }
) => {
  const firestore = getFirestore();
  const user = firestore.auth().currentUser;
  const photoURL = getState().firebase.profile.photoURL;
  const attendee = {
    going: true,
    joinDate: Date.now(),
    photoURL: photoURL || '/assets/user.png',
    displayName: user.displayName,
    host: false
  };
  try {
    await firestore.update(`events/${event.id}`, {
      [`attendees.${user.uid}`]: attendee
    });
    await firestore.set(`event_attendee/${event.id}_${user.uid}`, {
      eventId: event.id,
      userUid: user.uid,
      eventDate: event.date,
      host: false
    });
    toastr.success("Success", "You have signed up to the event");
  } catch (error) {
    console.log(error);
    toastr.error("Oops", "Problem signing up to event");
  }
};

export const cancelGoingToEvent = event => async (
  dispatch,
  getState,
  { getFirestore }
) => {
  const firestore = getFirestore();
  const user = firestore.auth().currentUser;
  try {
    //remove attendee object from object map inside event
    await firestore.update(`events/${event.id}`, {
      //FieldValue.delete(), deletes individual field rather than the whole document
      [`attendees.${user.uid}`]: firestore.FieldValue.delete()
    });
    await firestore.delete(`event_attendee/${event.id}_${user.uid}`);
    toastr.success("Success", "You have removed yourself from the event");
  } catch (error) {
    console.log(error);
    toastr.error("Oops", "Something went wront");
  }
};
