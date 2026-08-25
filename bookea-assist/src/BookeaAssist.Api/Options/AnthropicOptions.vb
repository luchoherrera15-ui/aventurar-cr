Namespace Options

    ''' <summary>
    ''' Configuración de la integración con la API de Claude (Anthropic).
    ''' Se enlaza desde la sección "Anthropic" de appsettings.json / variables de entorno.
    ''' </summary>
    Public Class AnthropicOptions

        Public Const SeccionConfiguracion As String = "Anthropic"

        ''' <summary>API key de Anthropic. Viene de una variable de entorno, nunca hardcodeada.</summary>
        Public Property ApiKey As String = String.Empty

        ''' <summary>Modelo de Claude a usar (ej. "claude-opus-5", "claude-sonnet-5").</summary>
        Public Property Modelo As String = "claude-opus-5"

    End Class

End Namespace
