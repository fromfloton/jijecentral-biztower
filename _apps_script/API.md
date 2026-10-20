# 소유자 라운지 API 명세

NAS로 옮길 때 이 형식을 그대로 구현하면 화면(mypage.html, login.html)은 주소만 바꾸면 된다.

- 요청: `POST`, 본문은 JSON 문자열(`Content-Type: text/plain;charset=utf-8`)
- 응답: JSON, 항상 `success`(true/false) 포함. 세션이 만료되면 `{ success:false, message:"unauthorized" }`

| action | 요청 | 성공 응답 |
|---|---|---|
| `login` | `phone`, `password` | `token`, `name`, `room`, `role`(A=관리위원, O=소유자) |
| `list` | `token`, `folderId`(없으면 최상위) | `items[]` (아래 참고) |
| `thumbs` | `token`, `folderId`, `fileIds[]`(최대 20개) | `thumbs: { 파일ID: { mimeType, base64 } }` — 썸네일이 없는 파일은 빠짐 |
| `preview` | `token`, `folderId`, `fileId` | `name`, `mimeType`, `base64` (긴 변 1600px) + 서버에서 읽음 처리 |
| `download` | `token`, `fileId` | `name`, `mimeType`, `base64` (원본) + 서버에서 읽음 처리 |

`items[]` 항목

| 필드 | 폴더 | 파일 | 설명 |
|---|---|---|---|
| `type` | `"folder"` | `"file"` | |
| `id`, `name` | O | O | |
| `category` | O | O | 최상위만 `"A"`/`"O"`, 하위는 `null` |
| `isNew` | O | O | 파일: 이 호실이 안 누른 새 자료 / 폴더: 안에 그런 파일이 있음 |
| `updated`, `created` | | O | ISO 8601 |
| `mimeType`, `size`, `hasThumb` | | O | |

N(새 자료) 규칙: 업로드·수정 후 14일 이내이면서 그 호실이 아직 안 눌렀거나, 누른 뒤 **내용이** 바뀐 경우
(이름 변경·이동은 제외). 읽음 기록은 호실 단위(시트 `reads`: 읽은주체 | 파일ID | 클릭시각(ms) | 내용값(md5)).
