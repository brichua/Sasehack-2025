import { Firestore, getFirestore } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import { db, auth } from "./firebase"; // make sure db is exported from your firebase.js
import { signOut } from "firebase/auth";

export default function Questboard({ route,navigation }) {
  const { userId } = route.params;
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        setDisplayName(userDoc.data().displayName);
      } else {
        setDisplayName("Unknown User");
      }
    };

    fetchUser();
  }, [userId]);

   const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigation.replace("SignIn"); // Navigate back to SignIn screen
    } catch (error) {
      console.error("Sign out failed:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🏰 Questboard</Text>
      <Text style={styles.subheader}>Welcome, {displayName}!</Text>
      {/* Here you can integrate your Questboard list, XP, badges etc. */}

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f7f1e3" },
  header: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
  subheader: { fontSize: 16 },
});
