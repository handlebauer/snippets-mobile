import { Text, TextProps } from './base/themed'

export function MonoText(props: TextProps) {
    return (
        <Text {...props} style={[props.style, { fontFamily: 'SpaceMono' }]} />
    )
}
