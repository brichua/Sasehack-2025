import { Firestore, getFirestore } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import { db, auth } from "./firebase"; // make sure db is exported from your firebase.js
import { signOut } from "firebase/auth";

export default function Questboard({ route,navigation }) {
  const { userId } = route.params;
  const [displayName, setDisplayName] = useState("");
  const [quests, setQuests] = useState([]);

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
  

  useEffect(() => {
    const fetchQuests = async () => {
      const questSnap = await getDocs(collection(db, "quests"));
      const questList = questSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuests(questList);
    };
    fetchQuests();
  }, []);

  const handleCompleteQuest = async (quest) => {
    try {
      // Add user to quest's assignedTo
      const questRef = doc(db, "quests", quest.id);
      await updateDoc(questRef, { assignedTo: arrayUnion(userId) });

      // Update user's XP and badges
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        xp: (quest.xpReward || 0) + (user.xp || 0),
        badges: quest.badgeReward ? arrayUnion(quest.badgeReward) : [],
      });

      Alert.alert("Quest Completed!", `You earned ${quest.xpReward} XP${quest.badgeReward ? " and the badge: " + quest.badgeReward : ""}`);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const renderQuest = ({ item }) => (
    <View style={styles.questCard}>
      <Text style={styles.questTitle}>{item.title}</Text>
      <Text>{item.description}</Text>
      <Text>XP: {item.xpReward} {item.badgeReward ? `| Badge: ${item.badgeReward}` : ""}</Text>
      <TouchableOpacity style={styles.button} onPress={() => handleCompleteQuest(item)}>
        <Text style={styles.buttonText}>Complete Quest</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🏰 Questboard</Text>
      <Text style={styles.subheader}>Welcome, {displayName}!</Text>
      {/* Here you can integrate your Questboard list, XP, badges etc. */}

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
      <FlatList
        data={quests}
        keyExtractor={(item) => item.id}
        renderItem={renderQuest}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate("Profile", { userId })}>
        <Text style={{ color: "#fff", textAlign: "center" }}>Go to Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f1e3", padding: 10 },
  header: { fontSize: 28, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  questCard: { backgroundColor: "#fff", padding: 15, borderRadius: 10, marginBottom: 10 },
  questTitle: { fontSize: 18, fontWeight: "bold" },
  button: { backgroundColor: "#6c5ce7", padding: 10, borderRadius: 8, marginTop: 5 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  profileButton: { backgroundColor: "#00b894", padding: 12, borderRadius: 8, marginTop: 10 },
});
