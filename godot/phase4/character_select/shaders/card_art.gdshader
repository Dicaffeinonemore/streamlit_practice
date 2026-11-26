shader_type canvas_item;

// 카드 일러스트용: 비선택 카드는 채도·밝기를 낮춤 (웹 버전의 grayscale + brightness 필터와 동일)
uniform float saturation : hint_range(0.0, 1.0) = 1.0;
uniform float brightness : hint_range(0.0, 2.0) = 1.0;

void fragment() {
	vec3 gray = vec3(dot(COLOR.rgb, vec3(0.299, 0.587, 0.114)));
	COLOR.rgb = mix(gray, COLOR.rgb, saturation) * brightness;
}
