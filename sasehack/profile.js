import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert, Dimensions, FlatList } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";


export default function Profile({ route, navigation }) {
  const authUser = auth.currentUser;
  const uid = authUser?.uid;
  //const { userId } = route.params;
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const docRef = doc(db, "Users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setUser(docSnap.data());
    };
    fetchUser();
  }, [uid]);

  const handleLogout = async () => {
    await signOut(auth);
    navigation.replace("Login");
  };

  if (!user) return <Text style={{textAlign:"center", marginTop:50}}>Loading...</Text>;

  const badgeData = [
    { id: "01", image: require("./assets/adaptive-icon.png") },
    { id: "02", image: require("./assets/splash-icon.png") },
    { id: "03", image: require("./assets/favicon.png") } // add more as needed
  ];

  const badgeWidth = Dimensions.get("window").width;
  const renderBadge = ({ item }) => (
    <View style={[styles.badgeContainer, { width: badgeWidth * 0.8 }]}>
      <Image source={item.image} style={styles.badgeIcon} />
      <Text style={styles.badgeText}>Badge ID: {item.id}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f1e3" }}>
    <View style={styles.container}>
      
      {user.avatarUrl && <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />}
      <Text style={styles.name}>{user.displayName}</Text>
      <Text style={styles.email}>{user.email}</Text>
      
      <Text style={styles.xp}>XP: {user.xp || 0}</Text>
      <Text style={styles.badges}>Badges: {(user.badges || []).join(", ") || "None"}</Text>
       {/* Badge Carousel */}
      <FlatList
        data={badgeData}
        renderItem={renderBadge}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: badgeWidth * 0.1 }}
      />
      
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
      
    

      
    </View>
    </SafeAreaView>
    
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
  badgeContainer: {
    height: 200,
    marginHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 10,
  },
  badgeIcon: { width: 100, height: 100, marginBottom: 10 },
  badgeText: { fontSize: 14 }

});
