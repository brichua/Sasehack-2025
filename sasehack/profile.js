import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal
} from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from './styles';
import { FontAwesome } from '@expo/vector-icons';

const CLASS_ICONS = {
  Explorer: 'map',
  Baker: 'cutlery',
  Artist: 'paint-brush'
};

export default function Profile({ navigation }) {
  const authUser = auth.currentUser;
  const uid = authUser?.uid;

  const [user, setUser] = useState(null);
  const [completedQuests, setCompletedQuests] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingQuests, setLoadingQuests] = useState(true);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null); // can be post or quest
  const [activeTab, setActiveTab] = useState("quests");

  const windowWidth = Dimensions.get("window").width;

  // ------------------ USER LIVE LISTENER ------------------
  useEffect(() => {
    if (!uid) {
      console.log("No UID found");
      setLoadingUser(false);
      return;
    }

    const userRef = doc(db, "Users", uid);

    const unsubscribe = onSnapshot(
      userRef,
      (userSnap) => {
        if (userSnap.exists()) {
          setUser(userSnap.data());
        } else {
          console.log("User document not found!");
        }
        setLoadingUser(false);
      },
      (error) => {
        console.error("Error fetching user:", error);
        setLoadingUser(false);
      }
    );
    
    return () => unsubscribe();
  }, [uid]);

  // ------------------ COMPLETED QUESTS LIVE ------------------
  useEffect(() => {
    if (!user || !uid) return;

    const userQuests = user.quests || [];
    const completedQuestIds = userQuests
      .filter((q) => q.completed)
      .map((q) => q.questID);
    setCompletedQuests(prev => prev.filter(q => completedQuestIds.includes(q.id)));
    console.log("Completed Quest IDs:", completedQuestIds);

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
        setCompletedQuests((prev) => {
          const otherQuests = prev.filter((q) => q.id !== questId);
          return [...otherQuests, { id: questSnap.id, ...questData }];
        });
      });
    });

    setLoadingQuests(false);

    return () => unsubscribes.forEach((fn) => fn());
  }, [user, uid]);

  // ------------------ USER POSTS LIVE ------------------
  useEffect(() => {
    if (!user || !uid) return;

    // ensure quests is an array and extract valid quest IDs (support questID or questId)
    const questIds = Array.isArray(user.quests)
      ? user.quests.map((q) => (q && (q.questID || q.questId))).filter(Boolean)
      : [];

    if (questIds.length === 0) {
      // no quests to subscribe to — clear any existing posts
      setUserPosts([]);
      return;
    }

    const unsubscribes = [];

    questIds.forEach((questId) => {
      if (!questId) return; // defensive
      const questRef = doc(db, "Quests", questId);

      const unsubscribe = onSnapshot(questRef, (questSnap) => {
        if (!questSnap.exists()) return;

        const questData = questSnap.data();
        const postsArray = Array.isArray(questData.posts) ? questData.posts : [];

        const userPostsInQuest = postsArray
          .filter((post) => post && post.userId === uid)
          .map((post, index) => {
            // normalize possible image keys on post and quest
            const postImage = post.image || post.imageUrl || post.imageURL || (post.assets && post.assets[0] && post.assets[0].uri) || null;
            const questImage = questData.image || questData.imageUrl || questData.imageURL || questData.cover || null;
            return ({
              ...post,
              questId,
              questTitle: questData.title,
              rewards: questData.rewards || {},
              user: questData.user || {}, // quest owner/info
              questImage: questImage,
              questClass: questData.class || null,
              image: postImage,
              index,
            });
          });

        setUserPosts((prev) => {
          const otherPosts = (Array.isArray(prev) ? prev : []).filter((p) => p.questId !== questId);
          return [...otherPosts, ...userPostsInQuest];
        });
      });

      if (typeof unsubscribe === 'function') unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach((fn) => fn());
  }, [user, uid]);

  // ------------------ UTILS ------------------
const getCompletedQuestCountsByClass = () => {
  const counts = { artist: 0, baker: 0, explorer: 0 };

  completedQuests.forEach((quest) => {
    const questClass = quest.class?.toLowerCase(); // make sure it's lowercase
    if (counts.hasOwnProperty(questClass)) {
      counts[questClass]++;
    }
  });

  return counts;
};


  const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");

  const formatDateTime = (input) => {
    if (!input) return "";
    try { if (input.toDate && typeof input.toDate === 'function') return new Date(input.toDate()).toLocaleString(); } catch(e){}
    if (input instanceof Date) return input.toLocaleString();
    try { const d = new Date(input); if (!isNaN(d.getTime())) return d.toLocaleString(); } catch(e){}
    return "";
  };

  const formatDateShort = (input) => {
    if (!input) return "";
    try { if (input.toDate && typeof input.toDate === 'function') return new Date(input.toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch(e){}
    if (input instanceof Date) return input.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    try { const d = new Date(input); if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch(e){}
    return "";
  };

  const computeLevel = (xpField) => {
    const xp = Array.isArray(xpField) ? xpField.reduce((a,b)=>a+(Number(b)||0),0) : (Number(xpField) || 0);
    return { xp: xp % 100, totalXp: xp, level: Math.floor(xp/100) };
  };

  const computeTopClass = (classField) => {
    if (!classField || typeof classField !== 'object') return null;
    let top = null; let topCount = -Infinity;
    Object.entries(classField).forEach(([k,v])=>{
      const n = Number(v) || 0;
      if (n > topCount) { top = k; topCount = n; }
    });
    return top;
  };

  const openDetail = (obj, type) => {
    setDetailItem({ ...obj, __type: type });
    setDetailModalVisible(true);
  };

  // ------------------ RENDERERS ------------------
  const renderQuestBadge = ({ item }) => {
    const start = item.startDate ? formatDate(item.startDate) : null;
    const end = item.endDate ? formatDate(item.endDate) : null;
    const dateRangeText =
      start && end ? `${start} — ${end}` : start ? `From ${start}` : end ? `Until ${end}` : null;

    // normalize possible image keys for quest
    const questImage = item.image || item.imageUrl || item.imageURL || item.cover || item.icon || item.questImage || null;

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => openDetail(item, 'quest')}>
      <View style={[styles.questBadgeContainer, { width: windowWidth * 0.8 }]}>
        {questImage ? (
          <Image source={{ uri: questImage }} style={styles.questBadgeIcon} />
        ) : (
          <View style={[styles.questBadgeIcon, { backgroundColor: "#dfe6e9" }]} />
        )}
        <Text style={styles.questBadgeTitle}>{item.title}</Text>
        <Text style={styles.questBadgeDesc}>{item.description}</Text>
        {dateRangeText ? <Text style={styles.dateRange}>{dateRangeText}</Text> : null}
      </View>
      </TouchableOpacity>
    );
  };

  const renderPostBadge = ({ item }) => (
    <TouchableOpacity activeOpacity={0.85} onPress={() => openDetail(item, 'post')}>
    <View style={[styles.postCardContainer, { width: windowWidth * 0.9 }]}>
      <Text style={styles.postedUnder}>
        posted under <Text style={styles.questTitleLabel}>{item.questTitle}</Text>
      </Text>

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

      {item.image ? <Image source={{ uri: item.image }} style={styles.postImage} /> : null}
    </View>
    </TouchableOpacity>
  );

  const handleLogout = async () => {
    await signOut(auth);
    navigation.replace("Login");
  };

  

  const renderBadge = ({ item }) => {
      console.log("Badge item:", item);
      return (
        <View style={[styles.badgeContainer, { width: windowWidth * 0.8 }]}>
          <Text style={styles.badgeTitle}>{item.title || "No title"}</Text>
          <Text style={styles.badgeProgress}>Progress: {item.progress || "0"}</Text>
          <Text style={styles.badgeTier}>Tier: {item.tier || "0"}</Text>
        </View>
      );
};


  // ------------------ RENDER ------------------
  if (loadingUser) return <Text style={{ textAlign: "center", marginTop: 50 }}>Loading user...</Text>;
  const questCounts = getCompletedQuestCountsByClass();
  // class ranking (sorted by count desc)
  const classRanking = (() => {
    const map = user?.class && typeof user.class === 'object' ? { ...user.class } : {};
    const list = Object.entries(map).map(([k,v]) => ({ name: k, count: Number(v) || 0 }));
    list.sort((a,b) => b.count - a.count);
    return list;
  })();

  // badge tier counts
  const badgeTierCounts = (() => {
    const badges = user?.badges || {};
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0;
    if (Array.isArray(badges)) {
      badges.forEach(b => { const tier = Number(b?.tier) || 0; if (tier >= 1) t1++; if (tier >= 2) t2++; if (tier >= 3) t3++; if (tier >= 4) t4++; });
    } else if (typeof badges === 'object') {
      Object.values(badges).forEach(b => { const tier = Number(b?.tier) || 0; if (tier >= 1) t1++; if (tier >= 2) t2++; if (tier >= 3) t3++; if (tier >= 4) t4++; });
    }
    return { t1, t2, t3, t4 };
  })();
 
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.azureWeb }}>
      <ScrollView>
        <View style={styles.container}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, {backgroundColor: colors.mintCream, alignItems:'center', justifyContent:'center'}]}>
              <Text style={{fontWeight:'700', color: colors.textMuted}}>{(user?.displayName||'U').charAt(0)}</Text>
            </View>
          )}

          <View style={{alignItems:'center'}}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              <Text style={styles.name}>{user?.displayName}</Text>
              <View style={[styles.levelTag, {backgroundColor: colors.viridian}]}> 
                <Text style={styles.levelText}>Lv {computeLevel(user?.xp).level}</Text>
              </View>
              {computeTopClass(user?.class) ? (
                <View style={[styles.classTag, computeTopClass(user?.class).toLowerCase()==='explorer' ? {backgroundColor: colors.viridian} : computeTopClass(user?.class).toLowerCase()==='baker' ? {backgroundColor: colors.cambridgeBlue} : {backgroundColor: colors.mintGreen}]}>
                  <Text style={styles.classText}>{computeTopClass(user?.class)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.email}>{user?.email}</Text>

            <View style={styles.xpRow}>
              <View style={[styles.xpBarBg, {backgroundColor: colors.mintCream}] }>
                <View style={[styles.xpBarFill, { width: `${computeLevel(user?.xp).xp}%`, backgroundColor: colors.viridian }]} />
              </View>
              <Text style={styles.xpNumber}>{computeLevel(user?.xp).xp}/100</Text>
            </View>
          </View>

        
        <Text style = {{marginBottom: 20}}>
        <FlatList
          data={user?.badges ? Object.entries(user.badges).map(([key, value]) => ({ id: key, ...value })) : []}
          renderItem={renderBadge}
          keyExtractor={(item) => item.id}
          pagingEnabled
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: windowWidth * 0.1, paddingBottom: 0 }}
          style={{ height: 120}}
        />
        </Text>
        
          {/* Toggle Tabs */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, activeTab === "quests" && styles.activeButton]}
              onPress={() => setActiveTab("quests")}
            >
              <Text style={[styles.toggleText, activeTab === "quests" && styles.activeText]}>Completed Quests</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleButton, activeTab === "posts" && styles.activeButton]}
              onPress={() => setActiveTab("posts")}
            >
              <Text style={[styles.toggleText, activeTab === "posts" && styles.activeText]}>Posts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleButton, activeTab === "stats" && styles.activeButton]}
              onPress={() => setActiveTab("stats")}
            >
              <Text style={[styles.toggleText, activeTab === "stats" && styles.activeText]}>Stats</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === "quests" ? (
            loadingQuests ? (
              <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
            ) : completedQuests.length === 0 ? (
              <Text style={{ textAlign: "center", marginVertical: 20 }}>No completed quests yet!</Text>
            ) : (
              <View style={{ width: "100%", alignItems: "center", paddingBottom: 10 }}>
                {completedQuests.map((quest) => (
                  <View key={quest.id} style={{ marginBottom: 16, width: windowWidth * 0.8 }}>
                    {renderQuestBadge({ item: quest })}
                  </View>
                ))}
              </View>
            )
          ) : activeTab === "posts" ? (
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
          ) : (
            <View style={{ width: "100%", alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>User Stats</Text>
              <Text style={{ fontSize: 16 }}>Badges Earned: {user?.badges ? Object.keys(user.badges).length : 0}</Text>
              <Text style={{ fontSize: 16 }}>Posts Made: {userPosts.length}</Text>
              <Text style={{ fontSize: 16, marginTop: 10, fontWeight: "bold" }}>Completed Quests by Class:</Text>
              <Text style={{ fontSize: 16 }}>Artist: {questCounts.artist}</Text>
              <Text style={{ fontSize: 16 }}>Baker: {questCounts.baker}</Text>
              <Text style={{ fontSize: 16 }}>Explorer: {questCounts.explorer}</Text>
              <Text style={{ fontSize: 16 }}>Total Quests Completed: {completedQuests.length}</Text>

              <Text style={{ fontSize: 16, marginTop: 12, fontWeight: 'bold' }}>Class Ranking</Text>
              {classRanking.length > 0 ? (
                classRanking.map((c, i) => (
                  <Text key={c.name} style={{ fontSize: 15 }}>{i+1}. {c.name}: {c.count}</Text>
                ))
              ) : (
                <Text style={{ fontSize: 15 }}>No class progress yet</Text>
              )}

              <Text style={{ fontSize: 16, marginTop: 12, fontWeight: 'bold' }}>Badge Tiers</Text>
              <Text style={{ fontSize: 15 }}>Tier 1 : {badgeTierCounts.t1}</Text>
              <Text style={{ fontSize: 15 }}>Tier 2 : {badgeTierCounts.t2}</Text>
              <Text style={{ fontSize: 15 }}>Tier 3 : {badgeTierCounts.t3}</Text>
            </View>
          )}
        </View>
        {/* Detail Modal for quest or post */}
        <Modal visible={detailModalVisible} animationType="slide" onRequestClose={()=>setDetailModalVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#f6fff8' }}>
          <ScrollView style={{flex:1, padding:12, backgroundColor:'#f6fff8'}}>
            <TouchableOpacity onPress={()=>setDetailModalVisible(false)} style={{alignSelf:'flex-end', padding:8, marginTop: 20}}>
              <Text style={{fontWeight:'700'}}>Close</Text>
            </TouchableOpacity>
            {detailItem ? (
              <View style={{padding:12, backgroundColor:'#fff', borderRadius:12}}>
                {/* Quest-style display */}
                {detailItem.__type === 'quest' ? (
                  <>
                    {detailItem.image ? <Image source={{uri:detailItem.image}} style={{width:'100%',height:220,borderRadius:8,marginBottom:12}} /> : null}
                    <View style={{flexDirection:'row', alignItems:'center', marginTop:0}}>
                      <View style={{width:40,height:40,borderRadius:20,backgroundColor: colors.viridian,alignItems:'center',justifyContent:'center',marginRight:12}}>
                        <FontAwesome name={CLASS_ICONS[detailItem.class] || 'map-o'} size={18} color="#fff" />
                      </View>
                      <Text style={{fontSize:22,fontWeight:'800', color: colors.textDark, flexShrink:1}}>{detailItem.title || detailItem.questTitle}</Text>
                    </View>
                    {(detailItem.startDate || detailItem.endDate) ? (
                      <Text style={{marginTop:6, color: colors.textMuted}}>
                        {detailItem.startDate && detailItem.endDate
                          ? `${formatDateShort(detailItem.startDate)} — ${formatDateShort(detailItem.endDate)}`
                          : (detailItem.startDate ? `Starts ${formatDateShort(detailItem.startDate)}` : `Ends ${formatDateShort(detailItem.endDate)}`)}
                      </Text>
                    ) : null}
                    {detailItem.location ? <Text style={{marginTop:6, color: colors.viridian}}>{detailItem.location}</Text> : null}
                    <Text style={{marginTop:6}}>{detailItem.description}</Text>

                    <View style={{flexDirection:'row', alignItems:'center', marginTop:12}}>
                      <Text style={{fontWeight:'700', color: colors.textDark, marginRight:12}}>Obtained rewards</Text>
                      <View style={{flexDirection:'row', alignItems:'center'}}>
                        <View style={{flexDirection:'row', alignItems:'center', marginRight:16}}>
                          <FontAwesome name='bolt' size={16} color={colors.viridian} />
                          <Text style={{marginLeft:8, color: colors.textMuted}}>{detailItem.rewards?.xp || 0} XP</Text>
                        </View>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                          <FontAwesome name='trophy' size={16} color={colors.viridian} />
                          <Text style={{marginLeft:8, color: colors.textMuted}}>{detailItem.rewards?.badge || 'None'}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                      {detailItem.user?.icon ? <Image source={{uri:detailItem.user.icon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                      <Text>{detailItem.user?.name}</Text>
                    </View>
                  </>
                ) : (
                  /* post-style display */
                  <>
                    <Text style={{fontSize:20,fontWeight:'800', marginBottom:8}}>{detailItem.username || 'Post'}</Text>
                    {detailItem.userIcon ? <Image source={{uri:detailItem.userIcon}} style={{width:36,height:36,borderRadius:18,marginBottom:8}} /> : null}
                    <Text style={{marginBottom:8}}>{detailItem.description}</Text>
                    {detailItem.image ? <Image source={{uri:detailItem.image}} style={{width:'100%',height:180,borderRadius:8,marginTop:8}} /> : null}
                    {detailItem.createdAt ? <Text style={{color: colors.textMuted}}>{formatDateTime(detailItem.createdAt)}</Text> : null}

                    <View style={styles.separator} />

                    {detailItem.questImage ? <Image source={{uri:detailItem.questImage}} style={{width:'100%',height:220,borderRadius:8,marginBottom:12}} /> : null}
                    <View style={{flexDirection:'row', alignItems:'center', marginTop:0}}>
                      <View style={{width:40,height:40,borderRadius:20,backgroundColor: colors.viridian,alignItems:'center',justifyContent:'center',marginRight:12}}>
                        <FontAwesome name={CLASS_ICONS[detailItem.questClass] || 'map-o'} size={18} color="#fff" />
                      </View>
                      <Text style={{fontSize:22,fontWeight:'800', color: colors.textDark, flexShrink:1}}>{detailItem.title || detailItem.questTitle}</Text>
                    </View>
                    {(detailItem.startDate || detailItem.endDate) ? (
                      <Text style={{marginTop:6, color: colors.textMuted}}>
                        {detailItem.startDate && detailItem.endDate
                          ? `${formatDateShort(detailItem.startDate)} — ${formatDateShort(detailItem.endDate)}`
                          : (detailItem.startDate ? `Starts ${formatDateShort(detailItem.startDate)}` : `Ends ${formatDateShort(detailItem.endDate)}`)}
                      </Text>
                    ) : null}
                    {detailItem.location ? <Text style={{marginTop:6, color: colors.viridian}}>{detailItem.location}</Text> : null}
                    <Text style={{marginTop:6}}>{detailItem.description}</Text>

                    <View style={{flexDirection:'row', alignItems:'center', marginTop:12}}>
                      <Text style={{fontWeight:'700', color: colors.textDark, marginRight:12}}>Obtained rewards</Text>
                      <View style={{flexDirection:'row', alignItems:'center'}}>
                        <View style={{flexDirection:'row', alignItems:'center', marginRight:16}}>
                          <FontAwesome name='bolt' size={16} color={colors.viridian} />
                          <Text style={{marginLeft:8, color: colors.textMuted}}>{detailItem.rewards?.xp || 0} XP</Text>
                        </View>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                          <FontAwesome name='trophy' size={16} color={colors.viridian} />
                          <Text style={{marginLeft:8, color: colors.textMuted}}>{detailItem.rewards?.badge || 'None'}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                      {detailItem.user?.icon ? <Image source={{uri:detailItem.user.icon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                      <Text>{detailItem.user?.name}</Text>
                    </View>
                  </>
                  
                )}
              </View>
            ) : null}
          </ScrollView>
          </SafeAreaView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

// ------------------ STYLES ------------------
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", backgroundColor: "#eaf4f4" },
  avatar: { width: 120, height: 120, borderRadius: 60, marginVertical: 16 },
  separator: { height:1, backgroundColor:'#e6ece6', marginVertical:12, borderRadius:1 },
  name: { fontSize: 24, fontWeight: "bold" },
  email: { fontSize: 16, marginBottom: 8 },
  xp: { fontSize: 16, marginBottom: 12 },
  toggleContainer: { flexDirection: "row", justifyContent: "center", marginVertical: 20 },
  toggleButton: { paddingVertical: 10, paddingHorizontal: 16, marginHorizontal: 8, borderRadius: 8, backgroundColor: "#CCE3DE" },
  activeButton: { backgroundColor: "#6B9080" },
  toggleText: { fontSize: 16, fontWeight: "bold", color: "#2d3436" },
  activeText: { color: "#fff" },
  postCardContainer: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 16, alignItems: "flex-start", alignSelf: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 2 },
  postedUnder: { fontStyle: "italic", marginBottom: 8, color: "#636e72" },
  questTitleLabel: { fontSize: 15, fontWeight: "bold", color: "#6B9080", marginBottom: 12 },
  userInfoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, width: "100%" },
  userIconLarge: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  userTextColumn: { flex: 1, flexDirection: "column" },
  userName: { fontSize: 14, fontWeight: "600", color: "#2d3436", marginBottom: 2},
  postDescription: { fontSize: 14, color: "#2d3436", flexWrap: "wrap" },
  postImage: { width: "100%", height: 180, borderRadius: 8, marginTop: 8, resizeMode: "cover" },
  questBadgeContainer: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, marginTop: 10, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 2 },
  questBadgeIcon: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  questBadgeTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  questBadgeDesc: { fontSize: 12, textAlign: "center", marginBottom: 4 },
  dateRange: { fontSize: 12, color: "#636e72" },
  sectionTitle: { fontSize: 24, marginBottom: 5, alignSelf: "flex-start", paddingLeft: 16, fontWeight: "bold"},
  questTitle: { fontSize: 24, marginBottom: 2, marginTop: 20, alignSelf: "flex-start", paddingLeft: 16, fontWeight: "bold"},
  button:  {padding:12, borderRadius:10, backgroundColor:"#6b9080ff", marginVertical:8, alignItems:'center' },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  badgeContainer: {
    height: 100,
    marginHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6fff8ff",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 20, // increase margin between cards
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 6,
    elevation: 2,
  },
  badgeIcon: { width: 80, height: 80, borderRadius: 40, marginBottom: 10 },
  badgeTitle: { fontSize: 16, fontWeight: "bold" },
  badgeDesc: { fontSize: 12, textAlign: "center", marginVertical: 4 },
  badgeProgress: { fontSize: 12 },
  badgeTier: { fontSize: 12, fontStyle: "italic", paddingBottom: 20 },
  levelTag: { backgroundColor: '#6b9080', paddingHorizontal:8, paddingVertical:4, borderRadius:8, marginLeft:8},
  levelText: { color:'#fff', fontWeight:'700' },
  classTag: { backgroundColor:'#a4c3b2', paddingHorizontal:8, paddingVertical:4, borderRadius:8, marginLeft:8 },
  classText: { color:'#fff', fontWeight:'700' },
  xpRow: { flexDirection:'row', alignItems:'center', marginTop:8 },
  xpBarBg: { height:12, width:180, backgroundColor:'#e6f0ec', borderRadius:8, overflow:'hidden', marginRight:8 },
  xpBarFill: { height:12, backgroundColor:'#6b9080' },
  xpNumber: { fontSize:12, color:'#2d3436', fontWeight:'700' },
});


