import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Profile({ navigation }) {
  const authUser = auth.currentUser;
  const uid = authUser?.uid;

  const [user, setUser] = useState(null);
  const [completedQuests, setCompletedQuests] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingQuests, setLoadingQuests] = useState(true);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const docRef = doc(db, "Users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUser(docSnap.data());
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, [uid]);

  // Fetch completed quests
  useEffect(() => {
    if (!user) return; // wait until user is loaded

    const fetchCompletedQuests = async () => {
      try {
        const userQuests = user.Quest || []; // array of quest maps
        const completedQuestIds = userQuests
          .filter(quest => quest.completed)   // keep only completed quests
          .map(quest => quest.questID);       // extract the questID string

        

        // Log completed quest IDs
        console.log("Complete quest IDs:", completedQuestIds);

          if (completedQuestIds.length === 0) {
            setCompletedQuests([]);
            setLoadingQuests(false);
            return;
          }

        const questsDocs = await Promise.all(
          completedQuestIds.map(async (questId) => {
            const questDocRef = doc(db, "Quests", questId);
            const questSnap = await getDoc(questDocRef);
            if (questSnap.exists()) return { id: questSnap.id, ...questSnap.data() };
            return null;
          })
        );

        setCompletedQuests(questsDocs.filter(q => q !== null));
      } catch (error) {
        console.error("Error fetching quests:", error);
      } finally {
        setLoadingQuests(false);
      }
    };

    fetchCompletedQuests();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigation.replace("Login");
  };

  const windowWidth = Dimensions.get("window").width;

  const renderBadge = ({ item }) => (
    <View style={[styles.badgeContainer, { width: windowWidth * 0.8 }]}>
      {item.icon ? (
        <Image source={{ uri: item.icon }} style={styles.badgeIcon} />
      ) : (
        <View style={[styles.badgeIcon, { backgroundColor: "#dfe6e9" }]} />
      )}
      <Text style={styles.badgeTitle}>{item.title}</Text>
      <Text style={styles.badgeDesc}>{item.description}</Text>
      <Text style={styles.badgeProgress}>Progress: {item.progress}</Text>
      <Text style={styles.badgeTier}>Tier: {item.tier}</Text>
    </View>
  );

  
  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "";
  const renderQuestBadge = ({ item }) => {
      const start = item.startDate ? formatDate(item.startDate) : null;
      const end = item.endDate ? formatDate(item.endDate) : null;
      const dateRangeText = start && end ? `${start} — ${end}` : start ? `From ${start}` : end ? `Until ${end}` : null;
      const ended = item.endDate ? (new Date(item.endDate) < new Date()) : false;

  return(
    <View style={[styles.questBadgeContainer, { width: windowWidth * 0.8 }]} >
      {item.icon ? (
        <Image source={{ uri: item.icon }} style={styles.questBadgeIcon} />
      ) : (
        <View style={[styles.questBadgeIcon, { backgroundColor: "#dfe6e9" }]} />
      )}
      <Text style={styles.questBadgeTitle}>{item.title}</Text>
      <Text style={styles.questBadgeDesc}>{item.description}</Text>
      {dateRangeText ? <Text style={styles.dateRange}>{dateRangeText}</Text> : null}
    </View>
  )
};

  if (loadingUser) return <Text style={{ textAlign: "center", marginTop: 50 }}>Loading user...</Text>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f1e3" }}>
      <ScrollView>
      <View style={styles.container}>
        {user.avatarUrl && <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />}
        <Text style={styles.name}>{user.displayName}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.xp}>XP: {user.xp || 0}</Text>
        
        <Text style = {{marginBottom: 20}}>
        <Text style={styles.sectionTitle}>Badges:</Text>
        <FlatList
          data={user.badges}
          renderItem={renderBadge}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: windowWidth * 0.1, paddingBottom: 0 }}
          style={{ height: 220}}
        />
        </Text>
        
        <Text style={styles.questTitle}>Completed Quests:</Text>
        {loadingQuests ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
        ) : completedQuests.length === 0 ? (
          <Text style={{ textAlign: "center", marginVertical: 20 }}>No completed quests yet!</Text>
        ) : (
          <View style={{ width: '100%', alignItems: 'center', paddingBottom: 20, }}>
          {completedQuests.map((quest) => (
            <View key={quest.id} style={{ marginBottom: 16, width: windowWidth * 0.8 }}>
              {renderQuestBadge({ item: quest })}
            </View>
          ))}
        </View>

        )}

       
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", backgroundColor: "#f7f1e3" },
  avatar: { width: 120, height: 120, borderRadius: 60, marginVertical: 16 },
  name: { fontSize: 24, fontWeight: "bold" },
  email: { fontSize: 16, marginBottom: 8 },
  xp: { fontSize: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 24, marginBottom: 20, alignSelf: "flex-start", paddingLeft: 16, fontWeight: "bold", textDecorationLine: "underline" },
  questTitle: { fontSize: 24, marginBottom: 2, paddingTop: -200, alignSelf: "flex-start", paddingLeft: 16, fontWeight: "bold", textDecorationLine: "underline" },
  button: { backgroundColor: "#6c5ce7", padding: 12, borderRadius: 8, width: 200, marginVertical: 20 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  badgeContainer: {
    height: 200,
    marginHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 20 // increase margin between cards
  },
  badgeIcon: { width: 80, height: 80, borderRadius: 40, marginBottom: 10 },
  badgeTitle: { fontSize: 16, fontWeight: "bold" },
  badgeDesc: { fontSize: 12, textAlign: "center", marginVertical: 4 },
  badgeProgress: { fontSize: 12 },
  badgeTier: { fontSize: 12, fontStyle: "italic", paddingBottom: 20 },
  questBadgeContainer: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    marginTop: 30,
    alignItems: "center",
    
  },
  questBadgeIcon: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  questBadgeTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  questBadgeDesc: { fontSize: 12, textAlign: "center", marginBottom: 4 },
  questBadgeProgress: { fontSize: 12 },
  questBadgeTier: { fontSize: 12, fontStyle: "italic" },
});
