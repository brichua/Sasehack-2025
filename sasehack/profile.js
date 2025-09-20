import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Profile({ navigation }) {
  const authUser = auth.currentUser;
  const uid = authUser?.uid;

  const [user, setUser] = useState(null);
  const [completedQuests, setCompletedQuests] = useState([]);
  const [userQuests, setUserQuests] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingQuests, setLoadingQuests] = useState(true);
  const [activeTab, setActiveTab] = useState("quests");
  const [userPosts, setUserPosts] = useState([]);

  // Fetch user data
useEffect(() => {
  if (!uid) return;

  const userRef = doc(db, "Users", uid);

  const unsubscribe = onSnapshot(userRef, (userSnap) => {
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    setUser(userData);       // updates badges, XP, avatar, etc.
    setLoadingUser(false);   // stop loading spinner if it was showing
  }, (error) => {
    console.error("Error listening to user document:", error);
  });

  // Cleanup listener on unmount
  return () => unsubscribe();
}, [uid]);

useEffect(() => {
  if (!user || !uid) return;

  const userQuests = user.Quest || [];
  const completedQuestIds = userQuests
    .filter(q => q.completed)
    .map(q => q.questID);

  if (completedQuestIds.length === 0) {
    setCompletedQuests([]);
    setLoadingQuests(false);
    return;
  }

  const unsubscribes = completedQuestIds.map((questId) => {
    const questRef = doc(db, "Quests", questId);

    return onSnapshot(questRef, (questSnap) => {
      if (!questSnap.exists()) return;

      const questData = questSnap.data();
      setCompletedQuests(prev => {
        // Remove old entry for this quest
        const otherQuests = prev.filter(q => q.id !== questId);
        return [...otherQuests, { id: questSnap.id, ...questData }];
      });
    });
  });

  setLoadingQuests(false);

    // Cleanup listeners on unmount
    return () => unsubscribes.forEach(fn => fn());
  }, [user, uid]);

    
  useEffect(() => {
    if (!uid || !user) return;

    const questIds = (user.Quest || []).map(q => q.questID);
    const unsubscribes = [];

    questIds.forEach((questId) => {
      const questRef = doc(db, "Quests", questId);

      const unsubscribe = onSnapshot(questRef, (questSnap) => {
        if (!questSnap.exists()) return;

        const questData = questSnap.data();
        const postsArray = questData.posts || [];

        // Only include posts from current user
        const userPostsInQuest = postsArray
          .filter(post => post.userId === uid)
          .map((post, index) => ({
            questId,
            questTitle: questData.title,
            index,
            ...post
          }));

        // Update state for all posts
        setUserPosts(prevPosts => {
          // Remove old posts from this quest
          const otherPosts = prevPosts.filter(p => p.questId !== questId);
          return [...otherPosts, ...userPostsInQuest];
        });
      });

      unsubscribes.push(unsubscribe);
    });

    // Cleanup all listeners on unmount
    return () => unsubscribes.forEach(fn => fn());
  }, [uid, user]);



  const handleLogout = async () => {
    await signOut(auth);
    navigation.replace("Login");
  };
  const renderPostBadge = ({ item }) => {
  return (
    <View style={[styles.postCardContainer, { width: windowWidth * 0.9 }]}>
      {/* Posted under + quest title */}
      <Text style={styles.postedUnder}>
        posted under <Text style={styles.questTitleLabel}>{item.questTitle}</Text>
      </Text>

      {/* Row: user icon on left, user name + description on right */}
      <View style={styles.userInfoRow}>
        {item.userIcon ? (
          <Image source={{ uri: item.userIcon }} style={styles.userIconLarge} />
        ) : (
          <View style={[styles.userIconLarge, { backgroundColor: "#dfe6e9" }]} />
        )}

        <View style={styles.userTextColumn}>
          <Text style={styles.userName}>{item.username || "Unknown User"}:</Text>
          <Text style={styles.postDescription}>{item.description}</Text>
        </View>
      </View>

      {/* Post image */}
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      ) : null}
    </View>
  );
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
        
        <Text style={styles.sectionTitle}>Badges:</Text>
        <Text style = {{marginBottom: 20}}>
        
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
        <Text style={styles.questTitle}>Activity:</Text>
         {/* Toggle Buttons */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, activeTab === "quests" && styles.activeButton]}
              onPress={() => setActiveTab("quests")}
            >
              <Text
                style={[
                  styles.toggleText,
                  activeTab === "quests" && styles.activeText,
                ]}
              >
                Completed Quests
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleButton, activeTab === "posts" && styles.activeButton]}
              onPress={() => setActiveTab("posts")}
            >
              <Text
                style={[
                  styles.toggleText,
                  activeTab === "posts" && styles.activeText,
                ]}
              >
                Posts
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Conditional Content */}
          {activeTab === "quests" ? (
            loadingQuests ? (
              <ActivityIndicator
                size="large"
                color="#007AFF"
                style={{ marginVertical: 20 }}
              />
            ) : completedQuests.length === 0 ? (
              <Text style={{ textAlign: "center", marginVertical: 20 }}>
                No completed quests yet!
              </Text>
            ) : (
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  paddingBottom: 10,
                }}
              >
                {completedQuests.map((quest) => (
                  <View key={quest.id} style={{ marginBottom: 16, width: windowWidth * 0.8 }}>
                    {renderQuestBadge({ item: quest })}
                  </View>
                ))}
              </View>
            )
          ) : (
              userPosts.length === 0 ? (
                <Text style={{ textAlign: "center", marginVertical: 20 }}>No posts yet!</Text>
              ) : (
                <View style={{ width: "100%", alignItems: "center", paddingBottom: 10 }}>
                  {userPosts.map((post, index) => (
                    <View key={`${post.questId}-${index}`} style={{ marginBottom: 16, width: windowWidth * 0.8 }}>
                      {renderPostBadge({ item: post })}
                    </View>
                  ))}
                </View>
              )
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
  sectionTitle: { fontSize: 24, marginBottom: 5, alignSelf: "flex-start", paddingLeft: 16, fontWeight: "bold", textDecorationLine: "underline" },
  questTitle: { fontSize: 24, marginBottom: 2, marginTop: 20, alignSelf: "flex-start", paddingLeft: 16, fontWeight: "bold", textDecorationLine: "underline" },
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
    marginBottom: 20, // increase margin between cards
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
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
    marginBottom: 5,
    marginTop: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    
  },
  questBadgeIcon: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  questBadgeTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  questBadgeDesc: { fontSize: 12, textAlign: "center", marginBottom: 4 },
  questBadgeProgress: { fontSize: 12 },
  questBadgeTier: { fontSize: 12, fontStyle: "italic" },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 20,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#dfe6e9",
  },
  activeButton: {
    backgroundColor: "#6c5ce7",
  },
  toggleText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2d3436",
  },
  activeText: {
    color: "#fff",
  },

  postCardContainer: {
  backgroundColor: "#f0f0f0",
  borderRadius: 12,
  padding: 12,
  marginBottom: 16,
  alignItems: "flex-start",
  alignSelf: "center",
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 4,
  elevation: 2,
},
postHeader: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 8,
},
userIcon: {
  width: 40,
  height: 40,
  borderRadius: 20,
  marginRight: 8,
},
postedUnder: {
  fontStyle: "italic",
  marginBottom: 16,
  color: "#636e72", // subtle gray, optional
},
questTitleLabel: {
  fontSize: 20,
  fontWeight: "bold",
  color: "#2d3436",
  marginBottom: 20,
},
userInfoRow: {
  flexDirection: "row",
  alignItems: "flex-start",
  marginBottom: 0,
  width: "100%",
},
userIconLarge: {
  width: 40,
  height: 40,
  borderRadius: 20,
  marginRight: 10,
},
userTextColumn: {
  flex: 1,
  flexDirection: "column",
},
userName: {
  fontSize: 14,
  fontWeight: "600",
  color: "#2d3436",
  marginBottom: 2,
  textDecorationLine: "underline"
},
postDescription: {
  fontSize: 14,
  color: "#2d3436",
  flexWrap: "wrap",
},
postImage: {
  width: "100%",
  height: 180,
  borderRadius: 8,
  marginTop: 0,
  resizeMode: "cover",
},
});
