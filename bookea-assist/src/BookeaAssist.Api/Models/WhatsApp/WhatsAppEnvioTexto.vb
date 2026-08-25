Namespace Models.WhatsApp

    ''' <summary>Cuerpo para enviar un mensaje de texto vía POST /{PhoneNumberId}/messages.</summary>
    Public Class WhatsAppEnvioTexto

        <JsonPropertyName("messaging_product")>
        Public Property ProductoMensajeria As String = "whatsapp"

        <JsonPropertyName("recipient_type")>
        Public Property TipoDestinatario As String = "individual"

        <JsonPropertyName("to")>
        Public Property Para As String = String.Empty

        <JsonPropertyName("type")>
        Public Property Tipo As String = "text"

        <JsonPropertyName("text")>
        Public Property Texto As WhatsAppTextoEnvio

    End Class

    Public Class WhatsAppTextoEnvio

        <JsonPropertyName("preview_url")>
        Public Property PreviewUrl As Boolean = False

        <JsonPropertyName("body")>
        Public Property Body As String = String.Empty

    End Class

End Namespace
