import React from 'react'
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from 'react-native-paper'

import { MaterialCommunityIcons } from '@expo/vector-icons'

interface VideoFilterListProps {
    videos: any[]
    repos: string[]
    selectedRepo: string | null
    searchQuery: string
    onSearchChange: (query: string) => void
    onSelectRepo: (repo: string | null) => void
}

export function VideoFilterList({
    videos,
    repos,
    selectedRepo,
    searchQuery,
    onSearchChange,
    onSelectRepo,
}: VideoFilterListProps) {
    // Filter repos based on search
    const filteredRepos = React.useMemo(() => {
        if (!searchQuery) return repos
        const query = searchQuery.toLowerCase()
        return repos.filter(repo => repo.toLowerCase().includes(query))
    }, [repos, searchQuery])

    return (
        <>
            <View style={styles.searchContainer}>
                <MaterialCommunityIcons
                    name="magnify"
                    size={20}
                    color="#8E8E93"
                    style={styles.searchIcon}
                />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search repositories"
                    placeholderTextColor="#8E8E93"
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <FlatList
                data={filteredRepos}
                keyExtractor={item => item}
                style={styles.repoList}
                contentContainerStyle={styles.repoListContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
                ListHeaderComponent={
                    <Pressable
                        onPress={() => onSelectRepo(null)}
                        style={({ pressed }) => [
                            styles.repoItem,
                            pressed && styles.repoItemPressed,
                        ]}
                    >
                        <Text
                            style={[
                                styles.repoItemText,
                                !selectedRepo && styles.repoItemTextSelected,
                            ]}
                        >
                            All Videos ({videos.length})
                        </Text>
                        {!selectedRepo && (
                            <MaterialCommunityIcons
                                name="check"
                                size={20}
                                color="#0A84FF"
                            />
                        )}
                    </Pressable>
                }
                ListEmptyComponent={
                    <View style={styles.emptyRepoList}>
                        <Text style={styles.emptyRepoText}>
                            No repositories found
                        </Text>
                    </View>
                }
                renderItem={({ item: repo }) => (
                    <Pressable
                        onPress={() => onSelectRepo(repo)}
                        style={({ pressed }) => [
                            styles.repoItem,
                            pressed && styles.repoItemPressed,
                        ]}
                    >
                        <Text
                            style={[
                                styles.repoItemText,
                                selectedRepo === repo &&
                                    styles.repoItemTextSelected,
                            ]}
                            numberOfLines={1}
                        >
                            {repo}
                        </Text>
                        {selectedRepo === repo && (
                            <MaterialCommunityIcons
                                name="check"
                                size={20}
                                color="#0A84FF"
                            />
                        )}
                    </Pressable>
                )}
            />
        </>
    )
}

const styles = StyleSheet.create({
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 24,
        paddingHorizontal: 12,
        height: 36,
        backgroundColor: '#1C1C1E',
        borderRadius: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 17,
        padding: 0,
    },
    repoList: {
        flex: 1,
        minHeight: 300,
    },
    repoListContent: {
        paddingTop: 8,
    },
    repoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 44,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    },
    repoItemPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    repoItemText: {
        flex: 1,
        fontSize: 17,
        color: '#FFFFFF',
        marginRight: 8,
    },
    repoItemTextSelected: {
        color: '#0A84FF',
    },
    emptyRepoList: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyRepoText: {
        color: '#8E8E93',
        fontSize: 17,
        fontWeight: '600',
        marginTop: 16,
    },
})
