import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Image, FlatList, Alert, ScrollView, Platform } from 'react-native';
import styles, { colors } from './styles';
import { collection, getDocs, addDoc, doc, updateDoc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from './firebase';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { FontAwesome, FontAwesome6 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import googleConfig from './googleConfig';

// Small helper to format counts
const plural = (n, s) => `${n} ${s}${n===1? '':'s'}`;

export default function Guilds() {
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGuild, setNewGuild] = useState({ name:'', description:'', icon:'', class:'', location:'' });
  const [newGuildIcon, setNewGuildIcon] = useState(null);
  const [quests, setQuests] = useState([]);

  const CLASSES = [
    { name: 'Explorer', icon: 'map' },
    { name: 'Artist', icon: 'paintbrush' },
    { name: 'Performer', icon: 'masks-theater' },
    { name: 'Musician', icon: 'music' },
    { name: 'Foodie', icon: 'utensils' },
    { name: 'Historian', icon: 'landmark' },
    { name: 'Connector', icon: 'champagne-glasses' },
  ];

  const BADGES = [
    // Explorer
    { name: 'Trailblazer', class: 'Explorer', icon: 'person-hiking' },
    { name: 'Urban Explorer', class: 'Explorer', icon: 'city' },
    // Artist
    { name: 'Sketcher', class: 'Artist', icon: 'brush' },
    { name: 'Hands-on Artist', class: 'Artist', icon: 'cube' },
    { name: 'Creative Spark', class: 'Artist', icon: 'palette' },
    // Performer
    { name: 'Film Buff', class: 'Performer', icon: 'film' },
    { name: 'Broadway Bound', class: 'Performer', icon: 'masks-theater' },
    { name: 'Theater Aficionado', class: 'Performer', icon: 'ticket' },
    // Musician
    { name: 'Future Virtuoso', class: 'Musician', icon: 'guitar' },
    { name: 'Concert Connoisseur', class: 'Musician', icon: 'music' },
    // Foodie
    { name: 'Chef', class: 'Foodie', icon: 'kitchen-set' },
    { name: 'Baker', class: 'Foodie', icon: 'cake-candles' },
    { name: 'Taste Tester', class: 'Foodie', icon: 'pizza-slice' },
    { name: 'Something Sweet', class: 'Foodie', icon: 'mug-hot' },
    // Historian
    { name: 'Time Traveler', class: 'Historian', icon: 'archway' },
    { name: 'Walking through Time', class: 'Historian', icon: 'building-columns' },
    // Connector
    { name: 'Social Butterfly', class: 'Connector', icon: 'gifts' },
    { name: 'Community Enthusiast', class: 'Connector', icon: 'calendar' },
    { name: 'Stadium Regular', class: 'Connector', icon: 'football' },
  ];

  // Icon aliasing to handle FontAwesome6 name differences
  const ICON_ALIASES = {
    'cutlery': 'utensils',
    'map': 'map',
    'paint-brush': 'paintbrush',
    'paintbrush': 'paintbrush',
    'guitar': 'guitar',
    'music': 'music',
    'cookie-bite': 'cookie-bite',
    'cookie': 'cookie',
    'bread-slice': 'bread-slice',
    'birthday-cake': 'cake-candles',
    'mug-hot': 'mug-hot',
    'city': 'city',
    'landmark': 'landmark',
    'route': 'route',
    'pen-nib': 'pen-nib',
    'spray-can': 'spray-can',
    'theater-masks': 'masks-theater',
    'masks-theater': 'masks-theater',
    'star': 'star',
    'monument': 'monument',
    'book': 'book',
    'hands-helping': 'hands-helping',
    'user-friends': 'user-friends',
    'paintbrush': 'paintbrush',
    'brush': 'brush',
    'person-hiking': 'person-hiking',
    'palette': 'palette',
    'cube': 'cube',
    'film': 'film',
    'ticket': 'ticket',
    'kitchen-set': 'kitchen-set',
    'cake-candles': 'cake-candles',
    'pizza-slice': 'pizza-slice',
    'archway': 'archway',
    'building-columns': 'building-columns',
    'champagne-glasses': 'champagne-glasses',
    'gifts': 'gifts',
    'calendar': 'calendar',
    'football': 'football'
  };

  const normalizeIcon = (name) => ICON_ALIASES[name] || name || 'question';

  const BADGE_ICONS = BADGES.reduce((m,b)=>{ m[b.name] = b.icon || 'trophy'; return m; }, {});

  // UI state: view mode and filters
  const [viewMode, setViewMode] = useState('discover'); // 'discover' or 'my'
  const [selectedClasses, setSelectedClasses] = useState([]); // multi-select
  const [classFilterModal, setClassFilterModal] = useState(false);
  const [locationFilterModal, setLocationFilterModal] = useState(false);
  const [filteredBadges, setFilteredBadges] = useState([]);
  const [locationFilter, setLocationFilter] = useState({ coords: null, radiusKm: 5 });
  const [placeQuery, setPlaceQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null); // {name, coords}
  const [nameQuery, setNameQuery] = useState(''); // search by guild name

  // track current user's guild ids for quick checks
  const [currentUserGuilds, setCurrentUserGuilds] = useState([]);

  // fetch user's guilds list
  const fetchUserGuilds = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { setCurrentUserGuilds([]); return; }
      const udoc = await getDoc(doc(db, 'Users', user.uid));
      if (udoc.exists()) {
        const data = udoc.data();
        const g = Array.isArray(data.guilds) ? data.guilds : [];
        setCurrentUserGuilds(g);
      } else setCurrentUserGuilds([]);
    } catch (e) { console.warn('fetchUserGuilds', e); }
  };

  const fetchGuilds = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'Guilds'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGuilds(list);
    } catch (e) {
      console.warn('fetchGuilds', e);
      Alert.alert('Error', e.message || 'Failed to fetch guilds');
    }
    setLoading(false);
  };

  const fetchQuests = async () => {
    try {
      const snap = await getDocs(collection(db, 'Quests'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuests(list);
    } catch(e){ console.warn('fetchQuests', e); }
  };

  const handleCompleteQuest = async (quest) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      const userRef = doc(db, 'Users', user.uid);
      const udoc = await getDoc(userRef);
      const userData = udoc.exists() ? udoc.data() : {};

      const currentXp = Array.isArray(userData.xp) ? userData.xp.reduce((a,b)=>a+(Number(b)||0),0) : (Number(userData.xp) || 0);
      const rewardXp = quest?.rewards?.xp ? Number(quest.rewards.xp) : 0;
      const newXpTotal = currentXp + rewardXp;
      const newLevel = Math.floor(newXpTotal / 100);

      const updates = {};
      updates.xp = newXpTotal;
      updates.level = newLevel;

      if (quest.class) {
        const currentClassMap = (userData.class && typeof userData.class === 'object' && !Array.isArray(userData.class)) ? { ...userData.class } : {};
        const cls = quest.class;
        currentClassMap[cls] = (Number(currentClassMap[cls]) || 0) + 1;
        updates.class = currentClassMap;
      }

      if (quest.rewards && quest.rewards.badge) {
        const badgeTitle = quest.rewards.badge;
        const badgesField = userData.badges || {};
        let badgeObj = null;
        if (Array.isArray(badgesField)) {
          const found = badgesField.find(b => b.title === badgeTitle);
          if (found) badgeObj = { ...found };
        } else if (badgesField && typeof badgesField === 'object') {
          if (badgesField[badgeTitle]) badgeObj = { ...(badgesField[badgeTitle]) };
          else if (badgesField.title === badgeTitle) badgeObj = { ...badgesField };
        }
        if (!badgeObj) badgeObj = { title: badgeTitle, progress: 0, tier: 0 };
        badgeObj.progress = (Number(badgeObj.progress) || 0) + 1;
        const p = badgeObj.progress;
        let tier = 1;
        if (p >= 100) tier = 5;
        else if (p >= 50) tier = 4;
        else if (p >= 25) tier = 3;
        else if (p >= 5) tier = 2;
        badgeObj.tier = tier;
        const newBadgesMap = (badgesField && typeof badgesField === 'object' && !Array.isArray(badgesField)) ? { ...badgesField } : {};
        newBadgesMap[badgeTitle] = badgeObj;
        updates.badges = newBadgesMap;
      }

      const existingQuests = userData.quests || [];
      const questIndex = existingQuests.findIndex(q => q.questID === quest.id);
      if (questIndex === -1) {
        existingQuests.push({ questID: quest.id, completed: true });
      } else {
        existingQuests[questIndex].completed = true;
      }
      updates.quests = existingQuests;

      await updateDoc(userRef, updates);
      Alert.alert('Quest Completed!', `+${rewardXp} XP — Level ${newLevel}`);
      setQuestDetailModal(false);
      fetchQuests();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handleAddPost = async (quest) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      let imageUrl = null;
      if (newPostImage) imageUrl = newPostImage;

      let userIcon = '';
      let username = user.displayName || '';
      try {
        const udoc = await getDoc(doc(db, 'Users', user.uid));
        if (udoc.exists()) userIcon = udoc.data().avatarUrl || userIcon;
        if (udoc.exists()) username = udoc.data().displayName || username;
      } catch (e) { /* ignore */ }

      const questRef = doc(db, 'Quests', quest.id);
      await updateDoc(questRef, { posts: arrayUnion({ username, userIcon, description: newPostDesc, image: imageUrl, userId: user.uid }) });

      const userRef = doc(db, 'Users', user.uid);
      const udoc = await getDoc(userRef);
      const userData = udoc.exists() ? udoc.data() : {};
      const existingQuests = userData.quests || [];
      const questIndex = existingQuests.findIndex(q => q.questID === quest.id);
      if (questIndex === -1) {
        existingQuests.push({ questID: quest.id, completed: false });
        await updateDoc(userRef, { quests: existingQuests });
      }

      setNewPostDesc(''); setNewPostImage(null);
      const qdoc = await getDoc(questRef);
      if (qdoc.exists()) setViewingQuest({ id: qdoc.id, ...qdoc.data() });
      fetchQuests();
    } catch (e) { Alert.alert('Error adding post', e.message); }
  };

  useEffect(()=>{ fetchGuilds(); fetchQuests(); }, []);
  useEffect(()=>{ fetchUserGuilds(); }, []);

  const pickImage = async (setter) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.6 });
    if (!res.canceled) setter(res.assets[0].uri);
  };

  const handleCreateGuild = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in to create a guild');
      const data = {
        ...newGuild,
        icon: newGuildIcon || newGuild.icon || null,
        members: [user.uid],
        membersCount: 1,
        quests: []
      };
  const ref = await addDoc(collection(db, 'Guilds'), data);
  // add guild id to user's guilds array
  const userRef = doc(db, 'Users', user.uid);
  await updateDoc(userRef, { guilds: arrayUnion(ref.id) });
      setCreating(false);
      setNewGuild({ name:'', description:'', icon:'', class:'Explorer', location:'' });
      setNewGuildIcon(null);
      fetchGuilds();
  fetchUserGuilds();
    } catch(e){ Alert.alert('Error', e.message); }
  };

  const handleJoinGuild = async (g) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in to join');
      // prevent double-joining
      if ((g.members && Array.isArray(g.members) && g.members.includes(user.uid)) || (currentUserGuilds && currentUserGuilds.includes(g.id))) {
        Alert.alert('Joined', `You are already a member of ${g.name}`);
        return;
      }
  const ref = doc(db, 'Guilds', g.id);
  await updateDoc(ref, { members: arrayUnion(user.uid) });
  // add guild id to user's guilds array
  const userRef = doc(db, 'Users', user.uid);
  await updateDoc(userRef, { guilds: arrayUnion(g.id) });
      // optionally update membersCount locally (re-fetch)
      fetchGuilds();
  fetchUserGuilds();
      Alert.alert('Joined', `You joined ${g.name}`);
    } catch(e){ Alert.alert('Error', e.message); }
  };

  const openGuild = (g) => {
    setSelectedGuild(g);
    setModalVisible(true);
  };

  const handleLeaveGuild = async (g) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in');
      Alert.alert('Leave guild', `Are you sure you want to leave ${g.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
          const gRef = doc(db, 'Guilds', g.id);
          await updateDoc(gRef, { members: arrayRemove(user.uid) });
          const uRef = doc(db, 'Users', user.uid);
          await updateDoc(uRef, { guilds: arrayRemove(g.id) });
          fetchGuilds();
          fetchUserGuilds();
          // close modal if currently viewing this guild
          if (selectedGuild?.id === g.id) { setModalVisible(false); setSelectedGuild(null); }
          Alert.alert('Left', `You left ${g.name}`);
        }}
      ]);
    } catch(e) { Alert.alert('Error', e.message); }
  };

  // compute quests for a guild: prefer guild.quests array if present else global quests with guildId
  const questsForGuild = (g) => {
    if (!g) return [];
    if (Array.isArray(g.quests) && g.quests.length>0) return g.quests;
    // filter global quests by guildId
    return quests.filter(q => (q.guildId === g.id) || (q.class === g.class && q.guildId === g.id));
  };

  const formatDateShort = (input) => {
    if (!input) return "";
    try { if (input.toDate && typeof input.toDate === 'function') return new Date(input.toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch(e){}
    if (input instanceof Date) return input.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    try { const d = new Date(input); if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch(e){}
    return "";
  };

  const renderQuestCard = ({ item }) => {
    const start = item.startDate ? formatDateShort(item.startDate) : null;
    const end = item.endDate ? formatDateShort(item.endDate) : null;
    const dateRangeText = start && end ? `${start} — ${end}` : start ? `From ${start}` : end ? `Until ${end}` : null;
    const ended = item.endDate ? (new Date(item.endDate) < new Date()) : false;

    return (
      <View style={[styles.card]}>
        {item.image ? <Image source={{uri:item.image}} style={styles.cardImage} /> : null}

        <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
          {ended ? <Text style={styles.endedTag}>ENDED</Text> : null}
          <View style={{width:36,height:36,borderRadius:18,backgroundColor:colors.viridian,alignItems:'center',justifyContent:'center',marginRight:8}}>
            <FontAwesome6 name={normalizeIcon((CLASSES.find(c=>c.name===item.class) || {icon:'map'}).icon)} size={16} color={colors.mintCream} solid />
          </View>
          <Text style={styles.title}>{item.title}</Text>
        </View>

        {dateRangeText ? <Text style={styles.dateRange}>{dateRangeText}</Text> : null}

        <Text style={styles.mutedText}>{(item.description || '').slice(0,80)}{(item.description || '').length>80 ? "..." : ""}</Text>

        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8, alignItems:'center'}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <FontAwesome6 name='bolt' size={14} color={colors.viridian} />
            <Text style={[styles.metaText,{marginLeft:8}]}>{item.rewards?.xp ?? 0} XP</Text>
          </View>
          <View style={{flexDirection:'row', alignItems:'center'}}>
                                                                  { item.rewards?.badge && BADGE_ICONS[item.rewards.badge] ? (
                                                                    <FontAwesome6 name={normalizeIcon(BADGE_ICONS[item.rewards.badge])} size={16} color={colors.viridian} solid />
                                                                  ) : (
                                                                    <FontAwesome name='trophy' size={16} color={colors.viridian} />
                                                                  ) }
                                                                  <Text style={{marginLeft:8, color: colors.textMuted}}>{item.rewards?.badge || 'None'}</Text>
                                                                </View>
        </View>

        <View style={{flexDirection:'row', alignItems:'center', marginTop:10}}>
                  {item.user?.icon ? <Image source={{uri:item.user.icon}} style={styles.avatarSmall} /> : null}
                  <Text style={styles.metaText}>{item.user?.name || '—'}</Text>
                </View>
      </View>
    );
  };

  const handleCreateQuestForGuild = async (g, questData) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in to create quests');
      // ensure user is a member of the guild
      const isMember = (g.members && Array.isArray(g.members) && g.members.includes(user.uid)) || currentUserGuilds.includes(g.id);
      if (!isMember) throw new Error('You must be a member of the guild to create quests for it.');
      // Try to get user's avatar/displayName from Users doc (same behavior as Questboard)
      let userIcon = '';
      let displayName = user.displayName || '';
      try {
        const udoc = await getDoc(doc(db, 'Users', user.uid));
        if (udoc.exists()) userIcon = udoc.data().avatarUrl || userIcon;
        if (udoc.exists()) displayName = udoc.data().displayName || displayName;
      } catch (e) { /* ignore */ }

      const data = {
        ...questData,
        class: g.class,
        guildId: g.id,
        user: { name: displayName || '', icon: userIcon || '' },
        posts: [],
        rewards: { xp: (questData.difficulty||0)*10, badge: questData.badge || '' },
        location: questData.location || null
      };
      await addDoc(collection(db, 'Quests'), data);
      fetchQuests();
      Alert.alert('Quest created', 'Quest added to the guild feed');
    } catch(e){ Alert.alert('Error', e.message); }
  };

  // --- Google Places autocomplete helpers for guild location ---
  const fetchPredictions = async (query) => {
    if (!query) { setPredictions([]); return; }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleConfig.GOOGLE_API_KEY}&types=geocode`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.predictions) setPredictions(data.predictions);
    } catch (e) { console.warn('Places autocomplete error', e); }
  };

  // Fetch place details (lat/lng) for a place_id
  const fetchPlaceDetails = async (placeId) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleConfig.GOOGLE_API_KEY}&fields=geometry,name,formatted_address,address_component,address_components`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.result && data.result.geometry && data.result.geometry.location) {
        const result = data.result || {};
        const components = result.address_components || [];
        // Try to find a suitable city/locality value
        const findComp = (types) => {
          for (const t of types) {
            const found = components.find(c => Array.isArray(c.types) && c.types.includes(t));
            if (found) return found.long_name;
          }
          return null;
        };
        const city = findComp(['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1']);
        const preferredLocationText = result.formatted_address || result.name || city || '';
        return {
          name: result.name || result.formatted_address || '',
          address: result.formatted_address || '',
          city: city,
          coords: { lat: result.geometry.location.lat, lng: result.geometry.location.lng },
          preferredLocationText
        };
      }
    } catch (e) { console.warn('Place details error', e); }
    return null;
  };

  // Haversine distance (km)
  const haversineKm = (a, b) => {
    if (!a || !b) return Infinity;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aHarv = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
    return R * c;
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "";

  const [creatingQuest, setCreatingQuest] = useState(false);
  const [guildQuest, setGuildQuest] = useState({ title:'', description:'', difficulty:0, badge:'', image:null, location:'', placeCoords: null, startDate: null, endDate: null });
  const [questDetailModal, setQuestDetailModal] = useState(false);
  const [viewingQuest, setViewingQuest] = useState(null);
  const [viewingQuestGuild, setViewingQuestGuild] = useState(null);
  const [newPostDesc, setNewPostDesc] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateError, setDateError] = useState('');

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setGuildQuest(prev => {
        const updated = { ...prev, startDate: selectedDate.toISOString() };
        if (prev.endDate && new Date(prev.endDate) < selectedDate) {
          updated.endDate = null;
          setDateError('End date was before start date and was cleared.');
        } else setDateError('');
        return updated;
      });
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setGuildQuest(prev => ({ ...prev, endDate: selectedDate.toISOString() }));
      setDateError('');
    }
  };

  // Quick small create-quest UI inside guild modal

  const isUserMemberOf = (g) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    if (g?.members && Array.isArray(g.members) && g.members.includes(uid)) return true;
    if (currentUserGuilds && currentUserGuilds.includes(g.id)) return true;
    return false;
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.headerRow}>
        <View style={{flexDirection:'row'}}>
          <TouchableOpacity style={[styles.buttonSmall, {marginRight:6, backgroundColor: viewMode==='discover' ? colors.viridian : colors.cambridgeBlue}]} onPress={()=>setViewMode('discover')}><Text style={styles.buttonText}>Discover</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.buttonSmall, {backgroundColor: viewMode==='my' ? colors.viridian : colors.cambridgeBlue}]} onPress={()=>setViewMode('my')}><Text style={styles.buttonText}>My Guilds</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={()=>setCreating(true)}>
          <Text style={styles.buttonText}>Create Guild</Text>
        </TouchableOpacity>
      </View>

      {/* Top filter bar (Class + Location) */}
      <View style={styles.filterBar}>
        <TouchableOpacity style={[styles.filterButton, selectedClasses.length>0 && styles.filterButtonActive]} onPress={()=>setClassFilterModal(true)}>
          <Text style={[styles.filterText, selectedClasses.length>0 && styles.filterTextActive]}>Class</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.filterButton, selectedLocation && styles.filterButtonActive]} onPress={()=>setLocationFilterModal(true)}>
          <Text style={[styles.filterText, selectedLocation && styles.filterTextActive]}>Location</Text>
        </TouchableOpacity>
      </View>

      {/* Location Filter Modal */}
      <Modal visible={locationFilterModal} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.mintCream }] }>
            <Text style={styles.sheetTitle}>Filter by Location</Text>
            <TouchableOpacity style={[styles.buttonPrimary,{marginTop:6}]} onPress={async ()=>{ try { const { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') { Alert.alert('Permission denied', 'Location permission is required to use this filter.'); return; } const pos = await Location.getCurrentPositionAsync({}); const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocationFilter(prev=> ({...prev, coords: c})); setSelectedLocation({ name: 'My location', coords: c }); } catch (err) { console.warn('expo-location error', err); Alert.alert('Location error', err.message || 'Unable to get location'); } }}>
              <Text style={styles.buttonText}>Use My Location</Text>
            </TouchableOpacity>

            <Text style={{marginTop:10}}>Radius (km)</Text>
            <TextInput keyboardType='numeric' value={String(locationFilter.radiusKm)} onChangeText={(t)=>{ const v = Number(t) || 0; setLocationFilter(prev=> ({...prev, radiusKm: v})); }} style={[styles.input, {backgroundColor: colors.mintCream}]} />
            {predictions.length > 0 && (
              <View style={{backgroundColor:colors.mintCream, borderRadius:8, marginBottom:6}}>
                    {predictions.map(p => (
                  <TouchableOpacity key={p.place_id} style={{padding:8,borderBottomWidth:1,borderColor:'#eee'}} onPress={async ()=>{
                    const details = await fetchPlaceDetails(p.place_id);
                    if (details) {
                      setSelectedLocation(details);
                      const text = details.preferredLocationText || details.address || details.name || details.city || '';
                      setPlaceQuery(text);
                      setPredictions([]);
                    }
                  }}>
                    <Text>{p.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
              <TouchableOpacity style={[styles.buttonTertiary,{flex:1, marginRight:6, backgroundColor: colors.cambridgeBlue}]} onPress={()=>{ setSelectedLocation(null); setPlaceQuery(''); setLocationFilter({coords:null, radiusKm:5}); setLocationFilterModal(false); }}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.buttonPrimary,{flex:1, marginLeft:6}]} onPress={()=>{ setLocationFilter(prev=> ({...prev, /* coords already set by selection */})); setLocationFilterModal(false); }}>
                <Text style={styles.buttonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Name search filter */}
      <View style={{marginTop:10, marginBottom:6}}>
        <Text style={{fontWeight:'700', color: colors.textDark}}>Search</Text>
        <View style={{flexDirection:'row', alignItems:'center', marginTop:6}}>
          <TextInput placeholder='Search guilds by name' value={nameQuery} onChangeText={t=>setNameQuery(t)} style={[styles.input2, {flex:1, marginRight:8}]} />
          {nameQuery ? (
            <TouchableOpacity style={[styles.buttonSmall, {backgroundColor: colors.cambridgeBlue}]} onPress={()=>setNameQuery('')}>
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

  <FlatList data={guilds.filter(g=>{
        // view mode filter
        if (viewMode==='my' && !(currentUserGuilds.includes(g.id) || (g.members && g.members.includes(auth.currentUser?.uid)))) return false;
        // class filter (multi-select)
        if (selectedClasses.length > 0 && !selectedClasses.includes(g.class)) return false;
        // name search filter
        if (nameQuery && g.name && !g.name.toLowerCase().includes(nameQuery.toLowerCase())) return false;
        // location filter: prefer radius-based when locationFilter.coords is set
        if (locationFilter && locationFilter.coords) {
          // guilds may have placeCoords stored, or we fall back to no match
          const gcoords = g.placeCoords || (g.placeCoords && g.placeCoords.lat ? g.placeCoords : null);
          if (!gcoords) return false;
          const dist = haversineKm(locationFilter.coords, { lat: gcoords.lat, lng: gcoords.lng });
          if (dist > (locationFilter.radiusKm || 0)) return false;
        } else if (selectedLocation && g.location) {
          if (!g.location.toLowerCase().includes((selectedLocation.name||selectedLocation.address||'').toLowerCase().split(',')[0])) return false;
        }
        return true;
      })} keyExtractor={i=>i.id} renderItem={({item})=>(
        <TouchableOpacity style={styles.guildCard} onPress={()=>openGuild(item)}>
          {item.icon ? <Image source={{uri:item.icon}} style={{width:64,height:64,borderRadius:12,marginRight:12}} /> : <View style={{width:64,height:64,borderRadius:12,backgroundColor:colors.cambridgeBlue,marginRight:12,alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontWeight:'700'}}>G</Text></View>}
          <View style={{flex:1}}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              <FontAwesome6 name={normalizeIcon((CLASSES.find(c=>c.name===item.class) || {icon:'map'}).icon)} size={18} color={colors.textDark} solid style={{marginRight:8}} />
              <Text style={{fontWeight:'800', color: colors.textDark}}>{item.name}</Text>
            </View>
            <Text style={{color: colors.textMuted}} numberOfLines={2}>{item.description}</Text>
            <Text style={{marginTop:6, color: colors.textMuted}}>{plural((item.members||[]).length || item.membersCount || 0, 'member')}{item.location ? ` • ${item.location}` : ''}</Text>
          </View>
          {
            ((item.members && Array.isArray(item.members) && item.members.includes(auth.currentUser?.uid)) || currentUserGuilds.includes(item.id)) ? (
              <TouchableOpacity style={[styles.buttonSmall,{minWidth:80, backgroundColor: '#9AC6B7'}]} disabled={true}>
                <Text style={[styles.buttonText,{opacity:0.9}]}>Joined</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.buttonSmall,{minWidth:80, backgroundColor: colors.viridian}]} onPress={()=>handleJoinGuild(item)}>
                <Text style={styles.buttonText}>Join</Text>
              </TouchableOpacity>
            )
          }
        </TouchableOpacity>
      )} />

      {/* Create Guild Modal */}
      <Modal visible={creating} animationType='slide'>
        <ScrollView style={styles.modalScroll}>
          <TextInput placeholder='Guild name' style={styles.input} value={newGuild.name} onChangeText={t=>setNewGuild(prev=>({...prev, name:t}))} />
          <TextInput placeholder='Description' style={[styles.input,{height:100}]} value={newGuild.description} onChangeText={t=>setNewGuild(prev=>({...prev, description:t}))} multiline />
          <TextInput placeholder="Location (Optional)" style={styles.input} value={placeQuery || newGuild.location} onChangeText={(text)=>{ setPlaceQuery(text);setNewGuild(prev=>({...prev, location: ''})); fetchPredictions(text); }} />

                                {predictions.length > 0 && (
                                  <View style={{borderRadius:8, marginBottom:6}}>
                                    {predictions.map(p => (
                                      <TouchableOpacity key={p.place_id} style={{padding:8,borderBottomWidth:1,borderColor:'#eee'}} onPress={async ()=>{ const details = await fetchPlaceDetails(p.place_id); if (details) { const text = details.preferredLocationText || details.address || details.name || details.city || ''; setNewGuild(prev=> ({...prev, location: text, placeCoords: details.coords })); setPlaceQuery(text); setPredictions([]); } }}>
                                                          <Text>{p.description}</Text>
                                                        </TouchableOpacity>
                                    ))}
                                  </View>
                                )}

          <Text style={{fontWeight:'bold', marginTop:6}}>Class</Text>
          <View style={{flexDirection:'row', flexWrap:'wrap', marginVertical:8, justifyContent:'space-between'}}>
            {CLASSES.map(c=> (
              <TouchableOpacity key={c.name} style={{width:'30%', padding:8, marginBottom:8, borderWidth: newGuild.class===c.name?2:1, borderColor: newGuild.class===c.name?colors.viridian:'#ccc', borderRadius:8, flexDirection:'row', alignItems:'center'}} onPress={()=>setNewGuild(prev=>({...prev, class:c.name}))}>
                <FontAwesome6 name={normalizeIcon(c.icon)} size={18} color={newGuild.class===c.name ? colors.viridian : colors.text} solid style={{marginRight:8}} />
                <Text style={{color: colors.textDark}}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.button} onPress={()=>pickImage(setNewGuildIcon)}>
            <Text style={styles.buttonText}>Pick Icon (optional)</Text>
          </TouchableOpacity>
          {newGuildIcon ? <Image source={{uri:newGuildIcon}} style={{width:120,height:120,alignSelf:'center',borderRadius:12,marginVertical:8}} /> : null}

          <TouchableOpacity style={[styles.button,{backgroundColor:colors.viridian}]} onPress={handleCreateGuild}><Text style={styles.buttonText}>Create Guild</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button,{backgroundColor:colors.cambridgeBlue}]} onPress={()=>setCreating(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Class Filter Modal */}
      <Modal visible={classFilterModal} animationType="slide" transparent={true}>
                <View style={styles.modalBackdrop}>
                  <View style={[styles.sheet, { backgroundColor: colors.azureWeb }]}>
                    <Text style={styles.sheetTitle}>Filter by Class</Text>
                    {CLASSES.map(c => (
                      <TouchableOpacity key={c.name} style={styles.sheetRow} onPress={()=>{ setSelectedClasses(prev => prev.includes(c.name) ? prev.filter(x=>x!==c.name) : [...prev, c.name]); }}>
                        <View style={[styles.checkbox, selectedClasses.includes(c.name) && {backgroundColor:colors.viridian, borderColor: colors.viridian}]} />
                        <FontAwesome6 name={normalizeIcon(c.icon)} size={16} color={colors.viridian} solid style={{marginRight:10}} />
                        <Text style={styles.sheetText}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
      
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
                      <TouchableOpacity style={[styles.buttonTertiary,{flex:1, marginRight:6, backgroundColor: colors.cambridgeBlue}]} onPress={()=>{ setSelectedClasses([]); setClassFilterModal(false); }}>
                        <Text style={styles.buttonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.buttonPrimary,{flex:1, marginLeft:6}]} onPress={()=>setClassFilterModal(false)}>
                        <Text style={styles.buttonText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

      {/* Guild Detail Modal */}
      <Modal visible={modalVisible} animationType='slide'>
        <ScrollView style={styles.modalScroll}>
          {selectedGuild && (
            <>
              <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                {selectedGuild.icon ? <Image source={{uri:selectedGuild.icon}} style={{width:80,height:80,borderRadius:12,marginRight:12}} /> : null}
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <FontAwesome6 name={normalizeIcon((CLASSES.find(c=>c.name===selectedGuild.class) || {icon:'map'}).icon)} size={20} color={colors.textDark} solid style={{marginRight:8}} />
                    <Text style={{fontSize:20,fontWeight:'800', color: colors.textDark}}>{selectedGuild.name}</Text>
                  </View>
                  <Text style={{color: colors.textMuted}}>{selectedGuild.description}</Text>
                  <Text style={{marginTop:6, color: colors.textMuted}}>{plural((selectedGuild.members||[]).length || selectedGuild.membersCount || 0, 'member')}{selectedGuild.location ? ` • ${selectedGuild.location}` : ''}</Text>
                </View>
                {isUserMemberOf(selectedGuild) ? (
                  <TouchableOpacity style={[styles.buttonSmall,{minWidth:90, backgroundColor:colors.viridian}]} onPress={()=>handleLeaveGuild(selectedGuild)}><Text style={styles.buttonText}>Leave</Text></TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.buttonSmall,{minWidth:90, backgroundColor: colors.viridian}]} onPress={()=>handleJoinGuild(selectedGuild)}><Text style={styles.buttonText}>Join</Text></TouchableOpacity>
                )}
              </View>

              <View style={{marginTop:8}}>
                <Text style={{fontSize:18,fontWeight:'700', color: colors.textDark}}>Guild Quest Feed</Text>
                {isUserMemberOf(selectedGuild) ? (
                  <TouchableOpacity style={[styles.button,{marginTop:8, backgroundColor:colors.viridian}]} onPress={()=>setCreatingQuest(true)}>
                    <Text style={styles.buttonText}>Create Quest for Guild</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{color:'#666', marginTop:8}}>You must join this guild to create quests.</Text>
                )}
                <TouchableOpacity style={[styles.button,{backgroundColor:colors.cambridgeBlue}]} onPress={()=>{ setModalVisible(false); setSelectedGuild(null); }}><Text style={styles.buttonText}>Close</Text></TouchableOpacity>
                <FlatList
                    data={questsForGuild(selectedGuild)}
                    keyExtractor={i => i.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={async () => {
                          try {
                            const qref = doc(db, 'Quests', item.id);
                            const qdoc = await getDoc(qref);
                            if (qdoc.exists()) {
                              const qdata = { id: qdoc.id, ...qdoc.data() };
                              setViewingQuest(qdata);
                              if (qdata.guildId) {
                                try { const gdoc = await getDoc(doc(db,'Guilds', qdata.guildId)); if (gdoc.exists()) setViewingQuestGuild({ id: gdoc.id, ...gdoc.data() }); else setViewingQuestGuild(null); } catch(e){ setViewingQuestGuild(null); }
                              } else setViewingQuestGuild(null);
                            } else {
                              setViewingQuest(item); setViewingQuestGuild(null);
                            }
                          } catch (e) { setViewingQuest(item); setViewingQuestGuild(null); }
                          setQuestDetailModal(true);
                        }}>
                        {renderQuestCard({ item })}
                        </TouchableOpacity>
                    )}
                    style={{ marginTop: 8 }}
                    scrollEnabled={false}
                    ListEmptyComponent={<Text style={{ color: '#666', marginTop: 8 }}>No quests yet.</Text>}
                    />
              </View>

              {/* Create quest inline modal */}
              <Modal visible={creatingQuest} animationType='slide'>
                <ScrollView style={styles.modalScroll}>
                  <TextInput placeholder='Title' style={styles.input} value={guildQuest.title} onChangeText={t=>setGuildQuest(prev=>({...prev,title:t}))} />
                  <TextInput placeholder='Description' style={[styles.input,{height:100}]} value={guildQuest.description} onChangeText={t=>setGuildQuest(prev=>({...prev,description:t}))} multiline />

                  <TextInput placeholder="Location (Optional)" style={styles.input} value={placeQuery || guildQuest.location} onChangeText={(text)=>{ setPlaceQuery(text); setGuildQuest({...guildQuest, location: ''}); fetchPredictions(text); }} />

                                {predictions.length > 0 && (
                                  <View style={{borderRadius:8, marginBottom:6}}>
                                    {predictions.map(p => (
                                      <TouchableOpacity key={p.place_id} style={{padding:8,borderBottomWidth:1,borderColor:'#eee'}} onPress={async ()=>{ const details = await fetchPlaceDetails(p.place_id); if (details) { const text = details.preferredLocationText || details.address || details.name || details.city || ''; setGuildQuest(prev=> ({...prev, location: text, placeCoords: details.coords })); setPlaceQuery(text); setPredictions([]); } }}>
                                        <Text>{p.description}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                )}

                  <TouchableOpacity style={[styles.buttonSecondary]} onPress={()=>pickImage((uri)=>setGuildQuest(prev=>({...prev, image: uri})))}>
                    <Text style={styles.buttonText}>Pick Quest Image (Optional)</Text>
                  </TouchableOpacity>
                  {guildQuest.image ? <Image source={{uri:guildQuest.image}} style={{width:140,height:140,alignSelf:'center',borderRadius:10,marginVertical:8}} /> : null}

                  {/* Date Range */}
              <Text style={{marginTop:10, fontWeight:"bold"}}>Quest Date Range (optional)</Text>
              <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between"}}>
                <TouchableOpacity style={[styles.buttonSecondary,{flex:1, marginRight:6}]} onPress={()=>setShowStartPicker(true)}>
                  <Text style={styles.buttonText}>{guildQuest.startDate ? `Start: ${formatDate(guildQuest.startDate)}` : 'Set Start Date'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonSecondary,{flex:1, marginLeft:6}]} onPress={()=>setShowEndPicker(true)}>
                  <Text style={styles.buttonText}>{guildQuest.endDate ? `End: ${formatDate(guildQuest.endDate)}` : 'Set End Date'}</Text>
                </TouchableOpacity>
              </View>
              {dateError ? <Text style={{color:'red',marginTop:6}}>{dateError}</Text> : null}

              {showStartPicker && (
                <DateTimePicker value={guildQuest.startDate ? new Date(guildQuest.startDate) : new Date()} mode="date" display="default" onChange={handleStartDateChange} maximumDate={guildQuest.endDate ? new Date(guildQuest.endDate) : undefined} />
              )}

              {showEndPicker && (
                <DateTimePicker value={guildQuest.endDate ? new Date(guildQuest.endDate) : (guildQuest.startDate ? new Date(guildQuest.startDate) : new Date())} mode="date" display="default" onChange={handleEndDateChange} minimumDate={guildQuest.startDate ? new Date(guildQuest.startDate) : undefined} />
              )}

              {/* Class Picker */}
              <Text style={{marginTop:10, fontWeight:"bold"}}>Select Class:</Text>
              <View style={{flexDirection:"row", flexWrap:'wrap', marginVertical:5, justifyContent:'space-between'}}>
                {CLASSES.map((c) => (
                  <TouchableOpacity key={c.name} style={[guildQuest.class === c.name ? styles.classSelected : styles.classOption, {width:'30%'}]} onPress={() => { setGuildQuest(prev=>({...prev,class:c.name})); setFilteredBadges(BADGES.filter(b => b.class === c.name)); setGuildQuest(prev => ({...prev, badge:""})); }}>
                    <FontAwesome6 name={normalizeIcon(c.icon)} size={20} color={guildQuest.class===c.name ? colors.viridian : colors.text} solid style={{marginBottom:6}} />
                    <Text style={{color:colors.text, textAlign:'center'}}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Difficulty Stars */}
              <Text style={{fontWeight:"bold"}}>Select Difficulty:</Text>
      <View style={{flexDirection:"row", marginVertical:5}}>
        {[1,2,3].map((star)=>( <TouchableOpacity key={star} onPress={()=>setGuildQuest({...guildQuest,difficulty:star})}><FontAwesome name={star <= guildQuest.difficulty ? "star" : "star-o"} size={28} color="#A4C3B2" style={{marginRight:8}} /></TouchableOpacity> ))}
      </View>

              {/* Badge Picker */}
              {filteredBadges.length > 0 && (
                <>
                  <Text style={{fontWeight:"bold", marginTop:10}}>Select Badge Reward:</Text>
                  <View style={{flexDirection:"row", flexWrap:"wrap"}}>
                    {filteredBadges.map(b => (
                      <TouchableOpacity key={b.name} style={[guildQuest.badge === b.name ? styles.badgeSelected : styles.badgeOption, {flexDirection:'row', alignItems:'center'}]} onPress={()=>setGuildQuest(prev=>({...prev,badge:b.name}))}>
                        <FontAwesome6 name={normalizeIcon(BADGE_ICONS[b.name] || b.icon || 'trophy')} size={18} color={guildQuest.badge === b.name ? colors.viridian : colors.text} solid style={{marginRight:8}} />
                        <Text style={{color:colors.text}}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

                  <TouchableOpacity style={[styles.button,{backgroundColor:colors.viridian}]} onPress={async ()=>{ await handleCreateQuestForGuild(selectedGuild, guildQuest); setCreatingQuest(false); setGuildQuest({ title:'', description:'', difficulty:1, badge:'', image:null, location:'', placeCoords: null, startDate: null, endDate: null }); }}><Text style={styles.buttonText}>Create Quest</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.button,{backgroundColor:colors.mintGreen}]} onPress={()=>setCreatingQuest(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                </ScrollView>
              </Modal>

              {/* Quest Detail Modal */}
              <Modal visible={questDetailModal} animationType='slide'>
                <ScrollView style={styles.modalScroll}>
                  {viewingQuest && (
                    <>
                      {viewingQuest.image ? <Image source={{uri:viewingQuest.image}} style={{width:'100%',height:220,borderRadius:8,marginBottom:12}} /> : null}
                      <Text style={{fontSize:22,fontWeight:'800', color: colors.textDark, flexShrink:1}}>{viewingQuest.title}</Text>
                      {(viewingQuest.startDate || viewingQuest.endDate) ? (
                        <Text style={{marginTop:6, color: colors.textMuted}}>
                          {viewingQuest.startDate && viewingQuest.endDate
                            ? `${formatDateShort(viewingQuest.startDate)} — ${formatDateShort(viewingQuest.endDate)}`
                            : (viewingQuest.startDate ? `Starts ${formatDateShort(viewingQuest.startDate)}` : `Ends ${formatDateShort(viewingQuest.endDate)}`)}
                        </Text>
                      ) : null}
                      {viewingQuest.location ? <Text style={{marginTop:6, color: colors.viridian}}>{viewingQuest.location}</Text> : null}
                      <Text style={{marginTop:6}}>{viewingQuest.description}</Text>

                      <View style={{flexDirection:'row', alignItems:'center', marginTop:12}}>
                        <Text style={{fontWeight:'700', color: colors.textDark, marginRight:12}}>Available rewards</Text>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                          <View style={{flexDirection:'row', alignItems:'center', marginRight:16}}>
                            <FontAwesome name='bolt' size={16} color={colors.viridian} />
                            <Text style={{marginLeft:8, color: colors.textMuted}}>{viewingQuest.rewards?.xp || 0} XP</Text>
                          </View>
                          <View style={{flexDirection:'row', alignItems:'center'}}>
                            { viewingQuest.rewards?.badge && BADGE_ICONS[viewingQuest.rewards.badge] ? (
                              <FontAwesome6 name={normalizeIcon(BADGE_ICONS[viewingQuest.rewards.badge])} size={16} color={colors.viridian} solid />
                            ) : (
                              <FontAwesome name='trophy' size={16} color={colors.viridian} />
                            ) }
                            <Text style={{marginLeft:8, color: colors.textMuted}}>{viewingQuest.rewards?.badge || 'None'}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                        {viewingQuest.user?.icon ? <Image source={{uri:viewingQuest.user.icon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                        <Text style={{fontWeight:'600'}}>{viewingQuest.user?.name}</Text>
                      </View>

                      <View style={styles.separator} />
                      <Text style={{marginTop:0,fontSize:18,fontWeight:'bold'}}>Posts</Text>
                      <View style={styles.postsSection}>
                        {viewingQuest.posts?.length ? viewingQuest.posts.map((p,i)=>(
                          <View key={i} style={styles.postCard}>
                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
                              {p.userIcon ? <Image source={{uri:p.userIcon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                              <Text style={{fontWeight:'600'}}>{p.username}</Text>
                            </View>
                            <Text style={{color:'#333', marginBottom:6}}>{p.description}</Text>
                            {p.image && <Image source={{uri:p.image}} style={styles.postImagePreview} />}
                            {p.timeRange || p.createdAt || p.date ? (
                              <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                                <FontAwesome name='clock-o' size={14} color={colors.textMuted} />
                                <Text style={{marginLeft:8, color: colors.textMuted}}>
                                  {p.timeRange
                                    ? (typeof p.timeRange === 'string'
                                        ? formatDateShort(p.timeRange)
                                        : (p.timeRange.start && p.timeRange.end
                                            ? `${formatDateShort(p.timeRange.start)} — ${formatDateShort(p.timeRange.end)}`
                                            : (p.timeRange.start ? formatDateShort(p.timeRange.start) : (p.timeRange.end ? formatDateShort(p.timeRange.end) : ''))))
                                    : (p.createdAt ? formatDateShort(p.createdAt) : (p.date ? formatDateShort(p.date) : ''))
                                  }
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        )) : <Text style={{color:'#666'}}>No posts yet. Be the first to share!</Text>}
                      </View>

                      {/* Composer Box */}
                      {isUserMemberOf(selectedGuild) ? (
                        <>
                        <View style={styles.composerBox}>
                          <TextInput placeholder='Write a post... (max 50 words)' style={[styles.input,{flex:1, marginBottom:0, backgroundColor: '#fff'}]} value={newPostDesc} onChangeText={setNewPostDesc} multiline />
                          <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                            <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:colors.viridian}]} onPress={()=>pickImage(setNewPostImage)}>
                              <Text style={[styles.buttonText,{color:'#fff'}]}>Add Image</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:colors.viridian}]} onPress={()=>handleAddPost(viewingQuest)}>
                              <Text style={[styles.buttonText,{color:'#fff'}]}>Post</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:colors.mintGreen}]} onPress={()=>{ setNewPostDesc(''); setNewPostImage(null); }}>
                              <Text style={[styles.buttonText,{color:'#fff'}]}>Clear</Text>
                            </TouchableOpacity>
                          </View>
                          </View>
                          {newPostImage ? <Image source={{uri:newPostImage}} style={styles.postImagePreview} /> : null}
                        </>
                      ) : (
                        <Text style={{color:'#666', marginTop:8}}>Join the guild to post.</Text>
                      )}

                      <View style={{marginTop:8}}>
                        <TouchableOpacity style={[styles.button,{backgroundColor:colors.viridian}]} onPress={()=>handleCompleteQuest(viewingQuest)}>
                          <Text style={styles.buttonText}>Complete Quest</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button,{backgroundColor:colors.cambridgeBlue}]} onPress={()=>{ setQuestDetailModal(false); setViewingQuest(null); }}>
                          <Text style={styles.buttonText}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </ScrollView>
              </Modal>
            </>
          )}
        </ScrollView>
      </Modal>

    </View>
  );
}


