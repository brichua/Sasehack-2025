import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";

export default function Profile({ route, navigation }) {
  const { userId } = route.params;
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const docRef = doc(db, "users", userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setUser(docSnap.data());
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigation.replace("Login");
  };

  if (!user) return <Text style={{textAlign:"center", marginTop:50}}>Loading...</Text>;

  return (
    <View style={styles.container}>
      {user.avatarUrl && <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />}
      <Text style={styles.name}>{user.displayName}</Text>
      <Text style={styles.email}>{user.email}</Text>
      <Text style={styles.xp}>XP: {user.xp || 0}</Text>
      <Text style={styles.badges}>Badges: {(user.badges || []).join(", ") || "None"}</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f1e3" },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20 },
  name: { fontSize: 24, fontWeight: "bold" },
  email: { fontSize: 16, marginBottom: 10 },
  xp: { fontSize: 16, marginBottom: 5 },
  badges: { fontSize: 14, marginBottom: 20, textAlign:"center" },
  button: { backgroundColor: "#6c5ce7", padding: 12, borderRadius: 8, width: 200 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
});
