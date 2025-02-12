import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Modal, Portal, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import type { CodeInsights } from '@/lib/api'

interface InsightsModalProps {
    visible: boolean
    onClose: () => void
    insights?: CodeInsights
    isLoading?: boolean
}

// Dummy data for testing
const dummyInsights: CodeInsights = {
    summary:
        'Added error handling and input validation to the user registration flow, improving the robustness of the authentication system.',
    keyChanges: [
        'Implemented form validation for email and password fields',
        'Added error message display component',
        'Enhanced password strength requirements',
        'Integrated with backend validation endpoints',
    ],
    complexity: {
        before: 4.2,
        after: 5.1,
        explanation:
            'Slight increase in complexity due to additional validation logic, but improved overall code reliability.',
    },
    suggestions: [
        {
            title: 'Extract Validation Logic',
            description:
                'Consider moving validation rules to a separate utility function for better reusability.',
            priority: 'high',
        },
        {
            title: 'Add Unit Tests',
            description:
                'The new validation logic should be covered by unit tests to ensure reliability.',
            priority: 'medium',
        },
        {
            title: 'Documentation',
            description:
                'Add JSDoc comments to explain the validation requirements for future reference.',
            priority: 'low',
        },
    ],
}

export function InsightsModal({
    visible,
    onClose,
    insights = dummyInsights,
    isLoading = false,
}: InsightsModalProps) {
    const insets = useSafeAreaInsets()
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return '#FF453A'
            case 'medium':
                return '#FF9F0A'
            case 'low':
                return '#30D158'
            default:
                return '#8E8E93'
        }
    }

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onClose}
                contentContainerStyle={[
                    styles.insightsModalContainer,
                    {
                        marginTop: Math.max(insets.top, 20),
                        marginBottom: Math.max(insets.bottom, 20),
                    },
                ]}
            >
                <View style={styles.insightsModalInner}>
                    <View style={styles.insightsHeader}>
                        <MaterialCommunityIcons
                            name="lightbulb"
                            size={24}
                            color="#FFFFFF"
                        />
                        <Text style={styles.insightsTitle}>AI Insights</Text>
                    </View>

                    {isLoading ? (
                        <View style={styles.insightsLoadingContainer}>
                            <Text style={styles.insightsLoadingText}>
                                Analyzing your code changes...
                            </Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.insightsScrollView}
                            contentContainerStyle={styles.insightsScrollContent}
                            showsVerticalScrollIndicator={true}
                            alwaysBounceVertical={false}
                        >
                            {/* Summary Section */}
                            <View style={styles.insightsSection}>
                                <Text style={styles.insightsSectionTitle}>
                                    Summary
                                </Text>
                                <Text style={styles.insightsSummaryText}>
                                    {insights.summary}
                                </Text>
                            </View>

                            {/* Key Changes Section */}
                            <View style={styles.insightsSection}>
                                <Text style={styles.insightsSectionTitle}>
                                    Key Changes
                                </Text>
                                {insights.keyChanges.map((change, index) => (
                                    <View
                                        key={index}
                                        style={
                                            styles.insightsKeyChangeContainer
                                        }
                                    >
                                        <View
                                            style={
                                                styles.insightsChangeNumberBadge
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.insightsChangeNumberText
                                                }
                                            >
                                                {index + 1}
                                            </Text>
                                        </View>
                                        <Text
                                            style={styles.insightsKeyChangeText}
                                        >
                                            {change}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {/* Complexity Section */}
                            <View style={styles.insightsSection}>
                                <Text style={styles.insightsSectionTitle}>
                                    Complexity Analysis
                                </Text>
                                <View
                                    style={styles.insightsComplexityContainer}
                                >
                                    <View
                                        style={styles.insightsComplexityMetrics}
                                    >
                                        <View
                                            style={
                                                styles.insightsComplexityMetric
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.insightsMetricLabel
                                                }
                                            >
                                                Before
                                            </Text>
                                            <Text
                                                style={
                                                    styles.insightsMetricValue
                                                }
                                            >
                                                {insights.complexity.before.toFixed(
                                                    1,
                                                )}
                                            </Text>
                                        </View>
                                        <View
                                            style={
                                                styles.insightsComplexityArrow
                                            }
                                        >
                                            <MaterialCommunityIcons
                                                name="arrow-right"
                                                size={20}
                                                color="#8E8E93"
                                            />
                                        </View>
                                        <View
                                            style={
                                                styles.insightsComplexityMetric
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.insightsMetricLabel
                                                }
                                            >
                                                After
                                            </Text>
                                            <Text
                                                style={
                                                    styles.insightsMetricValue
                                                }
                                            >
                                                {insights.complexity.after.toFixed(
                                                    1,
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                    <View
                                        style={
                                            styles.insightsComplexityExplanationContainer
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.insightsComplexityExplanation
                                            }
                                        >
                                            {insights.complexity.explanation}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Suggestions Section */}
                            <View style={[styles.insightsLastSection]}>
                                <Text style={styles.insightsSectionTitle}>
                                    Suggestions
                                </Text>
                                {insights.suggestions.map(
                                    (suggestion, index) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.insightsSuggestionContainer,
                                                index <
                                                    insights.suggestions
                                                        .length -
                                                        1 &&
                                                    styles.insightsSuggestionMargin,
                                            ]}
                                        >
                                            <View
                                                style={
                                                    styles.insightsSuggestionHeader
                                                }
                                            >
                                                <View
                                                    style={
                                                        styles.insightsSuggestionTitleContainer
                                                    }
                                                >
                                                    <MaterialCommunityIcons
                                                        name={
                                                            suggestion.priority ===
                                                            'high'
                                                                ? 'alert-circle'
                                                                : suggestion.priority ===
                                                                    'medium'
                                                                  ? 'information'
                                                                  : 'lightbulb-outline'
                                                        }
                                                        size={20}
                                                        color={getPriorityColor(
                                                            suggestion.priority,
                                                        )}
                                                        style={
                                                            styles.insightsSuggestionIcon
                                                        }
                                                    />
                                                    <Text
                                                        style={
                                                            styles.insightsSuggestionTitle
                                                        }
                                                    >
                                                        {suggestion.title}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={[
                                                        styles.insightsPriorityBadge,
                                                        {
                                                            backgroundColor:
                                                                getPriorityColor(
                                                                    suggestion.priority,
                                                                ),
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={
                                                            styles.insightsPriorityText
                                                        }
                                                    >
                                                        {suggestion.priority}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text
                                                style={
                                                    styles.insightsSuggestionDescription
                                                }
                                            >
                                                {suggestion.description}
                                            </Text>
                                        </View>
                                    ),
                                )}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    insightsModalContainer: {
        margin: 20,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    insightsModalInner: {
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    insightsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
        gap: 8,
        backgroundColor: '#1A1A1A',
        zIndex: 1,
    },
    insightsTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    insightsScrollView: {
        maxHeight: '100%',
    },
    insightsScrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    insightsLoadingContainer: {
        padding: 24,
        alignItems: 'center',
    },
    insightsLoadingText: {
        fontSize: 14,
        color: '#CCCCCC',
    },
    insightsSection: {
        marginBottom: 16,
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    insightsLastSection: {
        marginBottom: -20,
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    insightsSectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    insightsSummaryText: {
        fontSize: 14,
        color: '#CCCCCC',
        lineHeight: 20,
    },
    insightsKeyChangeContainer: {
        flexDirection: 'row',
        marginVertical: 6,
        alignItems: 'flex-start',
    },
    insightsChangeNumberBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#2A2A2A',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    insightsChangeNumberText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    insightsKeyChangeText: {
        fontSize: 14,
        color: '#CCCCCC',
        flex: 1,
        lineHeight: 20,
    },
    insightsComplexityContainer: {
        backgroundColor: '#2A2A2A',
        padding: 16,
        borderRadius: 8,
        marginTop: 8,
    },
    insightsComplexityMetrics: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
    },
    insightsComplexityMetric: {
        alignItems: 'center',
        flex: 1,
    },
    insightsComplexityArrow: {
        paddingHorizontal: 16,
    },
    insightsMetricLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 4,
    },
    insightsMetricValue: {
        fontSize: 24,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    insightsComplexityExplanationContainer: {
        paddingTop: 16,
    },
    insightsComplexityExplanation: {
        fontSize: 14,
        color: '#CCCCCC',
        lineHeight: 20,
    },
    insightsSuggestionContainer: {
        backgroundColor: '#2A2A2A',
        padding: 16,
        borderRadius: 8,
        marginTop: 8,
    },
    insightsSuggestionMargin: {
        marginBottom: 12,
    },
    insightsSuggestionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    insightsSuggestionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    insightsSuggestionIcon: {
        marginRight: 8,
    },
    insightsSuggestionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
    },
    insightsPriorityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    insightsPriorityText: {
        fontSize: 12,
        color: '#FFFFFF',
        textTransform: 'capitalize',
        fontWeight: '500',
    },
    insightsSuggestionDescription: {
        fontSize: 14,
        color: '#CCCCCC',
        lineHeight: 20,
    },
})
