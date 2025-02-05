import React, { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Button, Text, TextInput, useTheme } from 'react-native-paper'

import { router } from 'expo-router'

import { useSupabase } from '@/contexts/supabase.context'

export function Auth() {
    const { signInWithPassword, signUp } = useSupabase()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const theme = useTheme()

    async function handleSubmit() {
        setLoading(true)
        try {
            if (isSignUp) {
                await signUp(email, password)
                Alert.alert('Please check your inbox for email verification!')
            } else {
                await signInWithPassword(email, password)
                router.replace('/(protected)/(tabs)')
            }
        } catch (error) {
            if (error instanceof Error) Alert.alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    // async function handleAppleSignIn() {
    //     try {
    //         const credential = await AppleAuthentication.signInAsync({
    //             requestedScopes: [
    //                 AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    //                 AppleAuthentication.AppleAuthenticationScope.EMAIL,
    //             ],
    //         })

    //         if (credential.identityToken) {
    //             try {
    //                 await signInWithIdToken({
    //                     provider: 'apple',
    //                     token: credential.identityToken,
    //                 })
    //                 router.replace('/(protected)/(tabs)')
    //             } catch (error) {
    //                 if (error instanceof Error) {
    //                     Alert.alert('Error', error.message)
    //                 }
    //             }
    //         }
    //     } catch (error) {
    //         // @ts-expect-error
    //         if (error.code === 'ERR_REQUEST_CANCELED') {
    //             return
    //         }
    //         if (error instanceof Error) {
    //             Alert.alert('Error', error.message)
    //         }
    //     }
    // }

    // async function handleGithubSignIn() {
    //     try {
    //         setLoading(true)
    //         await signInWithGithub()
    //     } catch (error) {
    //         if (error instanceof Error) {
    //             Alert.alert('Error', error.message)
    //         }
    //     } finally {
    //         setLoading(false)
    //     }
    // }

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: theme.colors.background },
            ]}
        >
            <View style={styles.titleContainer}>
                <Text
                    variant="headlineLarge"
                    style={[styles.title, { fontFamily: 'SpaceMono' }]}
                >
                    snippets
                </Text>
            </View>

            <View style={styles.formContainer}>
                {isSignUp && (
                    <TextInput
                        mode="outlined"
                        label="Username"
                        placeholder="Username"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        left={<TextInput.Icon icon="account" />}
                        style={styles.input}
                        theme={{
                            colors: {
                                primary: '#3797EF',
                            },
                        }}
                    />
                )}
                <TextInput
                    mode="outlined"
                    label="Email"
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    left={<TextInput.Icon icon="email" />}
                    style={styles.input}
                    theme={{
                        colors: {
                            primary: '#3797EF',
                        },
                    }}
                />

                <TextInput
                    mode="outlined"
                    label="Password"
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="lock" />}
                    style={styles.input}
                    theme={{
                        colors: {
                            primary: '#3797EF',
                        },
                    }}
                />
            </View>

            <View style={styles.buttonContainer}>
                <Button
                    mode="contained"
                    onPress={handleSubmit}
                    disabled={
                        loading ||
                        !email ||
                        !password ||
                        (isSignUp && !username)
                    }
                    loading={loading}
                    contentStyle={[
                        styles.button,
                        (loading ||
                            !email ||
                            !password ||
                            (isSignUp && !username)) &&
                            styles.buttonDisabled,
                    ]}
                    textColor="white"
                    buttonColor="#3797EF"
                    style={styles.buttonReset}
                >
                    {isSignUp ? 'Sign up' : 'Log in'}
                </Button>

                {/* Commenting out OAuth buttons
                <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.divider} />
                </View>

                <View style={styles.oauthButtonsContainer}>
                    {Platform.OS === 'ios' && (
                        <AppleAuthentication.AppleAuthenticationButton
                            buttonType={
                                AppleAuthentication
                                    .AppleAuthenticationButtonType.SIGN_IN
                            }
                            buttonStyle={
                                AppleAuthentication
                                    .AppleAuthenticationButtonStyle.BLACK
                            }
                            cornerRadius={4}
                            style={styles.appleButton}
                            onPress={handleAppleSignIn}
                        />
                    )}

                    <Button
                        mode="outlined"
                        onPress={handleGithubSignIn}
                        contentStyle={styles.button}
                        style={[styles.buttonReset, styles.githubButton]}
                        icon={({ size }) => (
                            <Ionicons
                                name="logo-github"
                                size={size}
                                color="#fff"
                            />
                        )}
                        loading={loading}
                        disabled={loading}
                        textColor="#fff"
                        buttonColor="#0969da"
                    >
                        Continue with GitHub
                    </Button>
                </View>
                */}

                <View style={styles.signupContainer}>
                    <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        {isSignUp
                            ? 'Already have an account?'
                            : "Don't have an account?"}{' '}
                    </Text>
                    <Button
                        mode="text"
                        compact
                        onPress={() => {
                            setIsSignUp(!isSignUp)
                            setUsername('')
                            setEmail('')
                            setPassword('')
                        }}
                        textColor="#3797EF"
                    >
                        {isSignUp ? 'Log in' : 'Sign up'}
                    </Button>
                </View>

                {/* {!isSignUp && (
                    <Button
                        mode="text"
                        compact
                        onPress={() => {}}
                        style={styles.forgotButton}
                        textColor="#3797EF"
                    >
                        Forgot password?
                    </Button>
                )} */}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 32,
        paddingTop: '15%',
    },
    titleContainer: {
        flex: 0.3,
        justifyContent: 'flex-end',
        paddingBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        fontSize: 42,
    },
    formContainer: {
        height: 148,
        justifyContent: 'flex-end',
        marginBottom: 8,
        marginTop: 32,
    },
    input: {
        backgroundColor: 'transparent',
        height: 44,
        marginBottom: 4,
    },
    buttonContainer: {
        flex: 0.2,
        paddingTop: 8,
    },
    button: {
        height: 44,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonReset: {
        borderRadius: 4,
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
    },
    forgotButton: {},
    appleButton: {
        width: '100%',
        height: 44,
    },
    githubButton: {
        borderWidth: 0,
        backgroundColor: '#0969da',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#dbdbdb',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#737373',
        fontSize: 12,
        fontWeight: '600',
    },
    oauthButtonsContainer: {
        gap: 12,
    },
})
